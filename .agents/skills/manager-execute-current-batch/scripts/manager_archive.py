"""Prepare/finalize around the real OpenSpec archive CLI; never implement spec merge."""
from __future__ import annotations
from copy import deepcopy
import re
import yaml
from manager_schema import require
from manager_store import beneath, decode, digest, encoded, now, uid
from manager_flow import decision
from manager_gate import check_command, fresh
from manager_tasks import complete
from plan_inputs import resolve_inputs


def seal(store,reference):
    decision(reference); history=store.history()
    require(not store.state.get('sealed_at') or history==store.state['seal'],'cannot refresh seal to hide historical edits')
    store.state.update(seal=history,sealed_at=now(),seal_decision=reference); store.commit()
    return {'sealed_units':len(history)}

def outside(store,cid):
    return {p:v for p,v in store.workspace().items() if not any(beneath(p,x) for x in (f'openspec/changes/{cid}','openspec/changes/archive','openspec/specs'))}

def prepare(store,e,reference):
    decision(reference); store.no_ticket(); store.guard_history()
    require(e['phase']=='archive' and e['state']!='blocked','only verified archive-ready work can archive')
    fresh(store,e,'apply'); complete(store,e)
    key=uid(); active=f'openspec/changes/{e["id"]}'
    rec={'id':key,'change':e['id'],'status':'prepared','decision_ref':reference,'at':now(),'active':store.mapping(active),'outside':outside(store,e['id']),'history':store.history(),'main_specs':store.mapping('openspec/specs') if store.file('openspec/specs').exists() else {},'contract':store.contract(e),'inputs':resolve_inputs(store.plan,e),'material':store.material(e)}
    store.state['tickets'][key]=deepcopy(rec)
    path=f'manager/runtime/archive-tickets/{key}.json'; store.commit({path:encoded(rec)})
    return {'ticket':path,'operator_command':['openspec','archive',e['id'],'--yes'],'automatic_archive':False}

def ticket(store,path):
    p=store.file(path); rec=decode(p.read_text())
    require(isinstance(rec,dict) and rec.get('id') in store.state['tickets'],'unknown archive ticket')
    saved=store.state['tickets'][rec['id']]
    require(all(saved.get(k)==v for k,v in rec.items() if k!='status'),'archive ticket integrity mismatch')
    return rec,saved

def finalize(store,path,destination):
    rec,saved=ticket(store,path); cid=rec['change']
    if saved['status']=='completed':
        require(store.proof(cid),'completed archive proof no longer valid'); return {'done':cid,'idempotent':True}
    require(saved['status']=='prepared','ticket was aborted')
    require(re.fullmatch(r'openspec/changes/archive/\d{4}-\d{2}-\d{2}-'+re.escape(cid),destination),'invalid archive destination')
    require(destination not in rec['history'],'archive destination must be new')
    active=f'openspec/changes/{cid}'
    require(not store.file(active).exists(),'active change still exists; real archive incomplete')
    expected={destination+p[len(active):]:v for p,v in rec['active'].items()}
    require(store.mapping(destination)==expected,'new archive differs from verified change contents')
    history=store.history()
    require(history==dict(rec['history'],**{destination:expected}),'old history changed or unrelated archive was added')
    require(outside(store,cid)==rec['outside'],'non-spec workspace changed during archive')
    check=check_command(store,['openspec','validate','--specs','--strict','--no-interactive'],store.policy().get('timeout_seconds',300))
    require(check['status']=='passed','post-archive main-spec validation failed; keep ticket for recovery')
    require(outside(store,cid)==rec['outside'] and store.history()==history,'workspace changed during archive verification')
    proof={'id':cid,'archive':destination,'files':expected,'contract':rec['contract'],'inputs':rec['inputs'],'material':rec['material'],'completed_at':now(),'validation':check}
    proof_path=f'manager/archive/completed/{cid}.json'; require(not store.file(proof_path).exists(),'completion record already exists without matching finalization')
    store.state['completed'][cid]=proof; store.state['seal']=history; saved['status']='completed'
    e=store.entry(cid); e['phase']='done'; e.pop('state',None); e.pop('review',None)
    store.commit({proof_path:encoded(proof)})
    return {'done':cid,'archive':destination,'proof':proof_path}

def abort(store,path,reference):
    decision(reference); rec,saved=ticket(store,path)
    require(saved['status']=='prepared','archive ticket not pending')
    active=f'openspec/changes/{rec["change"]}'
    specs=store.mapping('openspec/specs') if store.file('openspec/specs').exists() else {}
    require(store.mapping(active)==rec['active'] and store.history()==rec['history'] and outside(store,rec['change'])==rec['outside'] and specs==rec['main_specs'],'restore/audit interrupted archive before aborting')
    saved.update(status='aborted',abort_decision=reference); store.commit(); return {'aborted':rec['id']}

def prune(store,ids,reference):
    decision(reference); store.no_ticket(); store.guard_history()
    require(ids and len(set(ids))==len(ids),'unique nonempty ids required')
    for cid in ids: require(store.entry(cid)['phase']=='done' and store.proof(cid),'only proven completed work can be pruned')
    entries=[]
    for cid in ids:
        e=deepcopy(store.entry(cid)); e['inputs']=deepcopy(store.state['completed'][cid]['inputs']); e.pop('input_refs',None); entries.append(e)
    snapshot={'at':now(),'decision_ref':reference,'openspec':entries,'requirements':deepcopy(store.plan['requirements']),'batches':deepcopy(store.plan['batches'])}
    store.plan['openspec']=[e for e in store.plan['openspec'] if e['id'] not in ids]
    for b in store.plan['batches']:
        for w in b['waves']: w['openspec']=[x for x in w['openspec'] if x not in ids]
        b['waves']=[w for w in b['waves'] if w['openspec']]
    store.plan['batches']=[b for b in store.plan['batches'] if b['waves']]
    needed={r for e in store.plan['openspec'] for r in e.get('requirements',[])}
    store.plan['requirements']=[r for r in store.plan['requirements'] if r['id'] in needed]
    consumed={r for e in store.plan['openspec'] for r in e.get('input_refs',[])}
    if 'inputs' in store.plan: store.plan['inputs']=[i for i in store.plan['inputs'] if i['id'] in consumed]
    store.plan['current']={}
    path=f'manager/archive/plan-{uid()}.yaml'
    store.commit({path:yaml.safe_dump(snapshot,sort_keys=False,allow_unicode=True).encode()})
    return {'pruned':ids,'snapshot':path}


def import_completion(store,cid,destination,reference):
    """Audited legacy migration; records today's validation, never invents old gates."""
    decision(reference); store.no_ticket(); store.guard_history()
    require(re.fullmatch(r'openspec/changes/archive/\d{4}-\d{2}-\d{2}-'+re.escape(cid),destination),'invalid legacy archive destination')
    require(destination in store.state['seal'],'seal independently audited history before import')
    require(not store.file(f'openspec/changes/{cid}').exists(),'active change still exists')
    e=next((e for e in store.plan['openspec'] if e['id']==cid),None)
    require(e is None or e['phase']=='done','legacy import cannot mark active/cancelled work completed')
    if store.proof(cid): return {'imported':cid,'idempotent':True}
    require(cid not in store.state['completed'],'damaged prior completion cannot be replaced by import')
    files=store.mapping(destination)
    checks=[check_command(store,['openspec','validate','--specs','--strict','--no-interactive'],store.policy().get('timeout_seconds',300))]
    require(all(c['status']=='passed' for c in checks),'legacy current-spec validation failed')
    store.guard_history()
    proof={'id':cid,'archive':destination,'files':files,'contract':digest(files),'inputs':[],
           'completed_at':now(),'validation':checks[0],'migration':{'decision_ref':reference,'prior_gate':'unavailable','mode':'human-audited-history'}}
    path=f'manager/archive/completed/{cid}.json'
    require(not store.file(path).exists(),'existing proof file requires manual reconciliation')
    store.state['completed'][cid]=proof; store.commit({path:encoded(proof)})
    return {'imported':cid,'proof':path,'prior_gate':'unavailable'}
