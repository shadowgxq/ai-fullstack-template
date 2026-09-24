"""Task DAG scheduling and persistent claims; cooperative, not filesystem ACLs."""
from __future__ import annotations
from copy import deepcopy
import re
from manager_schema import Invalid, cycle_errors, parse, require, strings
from manager_store import PROTECTED, beneath, digest, now, overlap, rel, uid

TASK_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]*$')

def execution(store,e):
    p = store.file(f'openspec/changes/{e["id"]}/execution.yaml')
    if not p.exists(): return []
    data = parse(p.read_text())
    require(isinstance(data,dict) and isinstance(data.get('tasks'),list) and data['tasks'], 'execution.yaml needs a nonempty tasks list')
    ids = set(); tasks = data['tasks']
    for t in tasks:
        require(isinstance(t,dict) and isinstance(t.get('id'),str) and TASK_ID.fullmatch(t['id']), 'invalid task id')
        require(t['id'] not in ids, f'duplicate task id {t["id"]}'); ids.add(t['id'])
        require(isinstance(t.get('role'),str) and t['role'], 'task role required')
        for key in ('needs','reads','writes','resources','acceptance'):
            require(strings(t.get(key,[])), f'{t["id"]}: invalid {key}')
        require(t.get('acceptance'), f'{t["id"]}: acceptance required')
        for field in ('reads','writes'):
            t[field]=[rel(p) for p in t.get(field,[])]
        for pth in t.get('reads',[]) + t.get('writes',[]): store.file(pth)
        for pth in t.get('writes',[]):
            require(rel(pth) != '.' and not any(overlap(rel(pth),v) for v in PROTECTED), f'worker cannot write control/document path {pth}')
    for t in tasks:
        require(set(t.get('needs',[]))<=ids, f'{t["id"]}: unknown task dependency')
    require(not cycle_errors({t['id']:t.get('needs',[]) for t in tasks}), 'task dependency cycle')
    return tasks

def conflicts(a,b):
    if set(a.get('resources',[])) & set(b.get('resources',[])): return True
    ar = a.get('reads',[]) + a.get('writes',[]); br = b.get('reads',[]) + b.get('writes',[])
    return any(overlap(x,y) for x in a.get('writes',[]) for y in br) or any(overlap(x,y) for x in b.get('writes',[]) for y in ar)

def role_definition(store, name):
    import tomllib
    path = store.file(f'.codex/agents/{name}.toml')
    require(path.exists(), f'missing native role config: {name}')
    data = tomllib.loads(path.read_text())
    require(data.get('name')==name and data.get('description') and data.get('developer_instructions'), f'invalid native role config: {name}')
    return data

def records(store,e):
    contract = store.contract(e)
    return [r for r in store.state['claims'].values() if r['change']==e['id'] and r['contract']==contract]

def ready(store,e):
    require(e['phase']=='apply' and e['state']=='in-progress','start apply before task scheduling')
    tasks = execution(store,e); saved = records(store,e)
    done = {r['task']['id'] for r in saved if r['status']=='completed'}
    running = store.running(); policy = store.policy(); selected=[]; held=[]
    require(not any(r['status']=='running' for r in store.state['repairs'].values()), 'repair owns workspace; finish it before task scheduling')
    for task in tasks:
        tid = task['id']
        if tid in done: continue
        reasons=[]
        if any(r['change']==e['id'] and r['task']['id']==tid for r in running): reasons.append('already claimed; no automatic lease stealing')
        if not set(task.get('needs',[]))<=done: reasons.append('task dependencies unfinished')
        peers=[r['task'] for r in running]+selected
        if any(conflicts(task,p) for p in peers): reasons.append('read/write or runtime resource conflict')
        if len(running)+len(selected)>=policy.get('max_agents',4): reasons.append('agent capacity reached')
        writers=sum(bool(p.get('writes')) for p in peers)
        if task.get('writes') and writers>=policy.get('max_writers',2): reasons.append('writer capacity reached')
        try: role_definition(store,task['role'])
        except (Invalid,ValueError) as exc: reasons.append(str(exc))
        if reasons: held.append({'task':tid,'reasons':reasons})
        else: selected.append(deepcopy(task))
    return {'ready':selected,'held':held,'completed':sorted(done)}

def claim(store,e,tid,agent_id):
    require(agent_id and agent_id.strip(),'real native agent ID required')
    store.no_ticket(); store.guard_history()
    require(not any(r['agent_id']==agent_id for r in store.running()), 'agent already owns a running task')
    task=next((t for t in ready(store,e)['ready'] if t['id']==tid),None)
    require(task is not None, f'task not ready: {tid}')
    key=uid(); definition=role_definition(store,task['role'])
    store.state['claims'][key]={'id':key,'change':e['id'],'revision':e.get('revision',1),'contract':store.contract(e),'task':task,'agent_id':agent_id,'status':'running','started_at':now(),'before':store.workspace(),'tasks_text':store.file(f'openspec/changes/{e["id"]}/tasks.md').read_text(),'requested_model':definition.get('model'),'observed_model':None}
    store.commit()
    return {'run_id':key,'task':task,'contract':store.state['claims'][key]['contract'],'agent_id':agent_id,'observed_model':None}

def diff(before,after): return sorted(p for p in set(before)|set(after) if before.get(p)!=after.get(p))

def finish(store,key,result_path):
    rec=store.state['claims'].get(key); require(rec is not None,'unknown task claim')
    result_file=store.file(result_path); require(result_file.is_file(),'missing task result')
    result=parse(result_file.read_text()); require(isinstance(result,dict),'task result must be an object')
    result_hash=digest(result)
    if rec['status']=='completed':
        require(rec.get('result_hash')==result_hash,'different result for completed claim'); return {'status':'completed','idempotent':True}
    require(rec['status']=='running','claim no longer running')
    e=store.active(rec['change']); store.guard_history()
    require(rec['contract']==store.contract(e), 'stale task contract; do not integrate result')
    require(result.get('run_id')==key and result.get('agent_id')==rec['agent_id'] and result.get('contract')==rec['contract'], 'task result identity/contract mismatch')
    require(result.get('status') in ('completed','failed'), 'invalid task result status')
    actual=diff(rec['before'],store.workspace())
    # Concurrent disjoint writers may have finished since this claim began.
    peers=[r for r in store.state['claims'].values() if r['id']!=key and (r['status']=='running' or (r['status']=='completed' and r.get('finished_at','')>=rec['started_at']))]
    peers += [r for r in store.running() if r['id']!=key and r not in peers]
    owned=rec['task'].get('writes',[])
    allowed=owned+[p for r in peers for p in r['task'].get('writes',[])]
    # Only Manager may tick another finished task; semantic task changes still alter contract.
    status_file=f'openspec/changes/{e["id"]}/tasks.md'
    permitted_text=rec['tasks_text']
    for peer in peers:
        if peer['change']==e['id'] and peer['status']=='completed':
            pattern=rf'(?m)^(\s*[-*]\s+)\[ \](\s+(?:{re.escape(peer["task"]["id"])}|\[{re.escape(peer["task"]["id"])}\])(?:\s|:).*)$'
            permitted_text=re.sub(pattern,r'\1[x]\2',permitted_text)
    require(store.file(status_file).read_text()==permitted_text,'Worker modified tasks.md status; only Manager may mark task completion')
    outside=[p for p in actual if p!=status_file and not any(beneath(p,w) for w in allowed)]
    if outside:
        rec['status']='failed'; e['state']='blocked'; e['blockers']=['task wrote outside aggregate ownership: '+', '.join(outside)]
        store.commit(); return {'ok':False,'outside':outside}
    reported=result.get('changed_files',[])
    require(strings(reported) and all(any(beneath(p,w) for w in owned) for p in reported),'result reports unowned paths')
    require(all(p in actual for p in reported),'reported changes not found in workspace')
    if result['status']=='failed':
        rec.update(status='failed',result_hash=result_hash); store.commit(); return {'ok':False,'status':'failed'}
    checks=result.get('checks')
    require(isinstance(checks,list) and checks and all(isinstance(x,dict) and x.get('status')=='passed' and x.get('evidence') for x in checks),'task checks/evidence missing')
    evidence={x['evidence']:store.source({'source':x['evidence']}) for x in checks}
    tasks_path=store.file(status_file); require(tasks_path.exists(),'tasks.md missing')
    text=tasks_path.read_text(); tid=re.escape(rec['task']['id'])
    pattern=rf'(?m)^(\s*[-*]\s+)\[ \](\s+(?:{tid}|\[{tid}\])(?:\s|:).*)$'
    require(len(re.findall(pattern,text))==1,'task id must identify exactly one unchecked tasks.md item')
    new_text=re.sub(pattern,r'\1[x]\2',text)
    rec.update(status='completed',finished_at=now(),result_hash=result_hash,evidence=evidence,changed_files=reported)
    store.commit({status_file:new_text.encode()})
    return {'status':'completed','run_id':key,'evidence':evidence}

def release(store,key,stopped,decision):
    r=store.state['claims'].get(key); require(r and r['status']=='running','no running claim')
    require(stopped and decision,'confirm original native agent has stopped before release')
    r.update(status='released',decision_ref=decision,finished_at=now()); store.commit()
    return {'status':'released','run_id':key}

def complete(store,e):
    require(not any(r['change']==e['id'] for r in store.running()),'active tasks still running')
    tasks=execution(store,e)
    done={r['task']['id'] for r in records(store,e) if r['status']=='completed'}
    require({t['id'] for t in tasks}<=done,'execution tasks not completed')
    p=store.file(f'openspec/changes/{e["id"]}/tasks.md')
    require(p.exists(),'tasks.md missing')
    text=p.read_text()
    require(bool(re.search(r'(?m)^\s*[-*]\s+\[[xX]\]',text)),'no completed implementation tasks')
    require(not re.search(r'(?m)^\s*[-*]\s+\[ \]',text),'unchecked tasks remain')
