"""Approval, lifecycle, revision, bounded repair and Goal controls."""
from __future__ import annotations
from copy import deepcopy
import re
import shutil
import tomllib
from manager_schema import VERSION, PHASES, Invalid, parse, require, select_next, validate
from manager_store import PROTECTED, beneath, digest, now, overlap, rel, uid
from manager_tasks import complete, diff, execution, role_definition
from manager_gate import fresh


def decision(value): require(isinstance(value,str) and bool(value.strip()),'real approval/decision reference required')

def approve(store,document,sources,reference):
    decision(reference); store.no_ticket(); require(sources,'approval must bind at least one PRD source')
    document=str(store.file(document).relative_to(store.root))
    require(not beneath(document,'openspec/changes/archive'),'cannot approve/rewrite archived document')
    rec={'at':now(),'document':store.source({'source':document}),'sources':{},'decision_ref':reference}
    for source in sources:
        source=str(store.file(source).relative_to(store.root)); rec['sources'][source]=store.source({'source':source})
    store.state['approvals'][document]=rec; store.commit(); return {'approved':document,'sha256':digest(rec),'decision_ref':reference}

def deps(store,e,stage):
    errors=[]; entries={x['id']:x for x in store.plan['openspec']}
    for cid in e.get('depends_on',[]):
        d=entries.get(cid)
        if not d or d['phase']=='done':
            if not store.proof(cid): errors.append(f'{cid}: completion proof missing/changed')
            continue
        if d.get('state') in ('blocked','cancelled') or PHASES.index(d['phase']) < (1 if stage=='change' else 2):
            errors.append(f'{cid}: dependency not ready'); continue
        try:
            if stage=='apply': fresh(store,d,'apply',prerequisite=True)
            else:
                receipt=store.state['gates'].get(cid,{}).get('change')
                require(receipt and receipt['status']=='passed' and receipt['snapshot']['contract']==store.contract(d),'upstream change contract not verified')
        except Invalid as exc: errors.append(f'{cid}: {exc}')
    return errors

def eligible(store,e):
    store.active(e['id']); store.no_ticket(); store.guard_history(); store.policy()
    require(e['phase'] in ('change','apply'), 'only change/apply can start')
    require(e.get('state')!='blocked','blocked work needs explicit reopen')
    require(not deps(store,e,e['phase']),'; '.join(deps(store,e,e['phase'])))
    store.technical(e); contract=store.contract(e)
    if e['phase']=='apply':
        rec=store.state['reviews'].get(e['id'])
        require(e.get('review')=='approved' and rec and rec['contract']==contract,'change approval missing/stale')
    return contract

def next_work(store,scope='auto',batch=None):
    selected=select_next(store.plan,scope,batch)
    if selected['selected']:
        sel=selected['selected']; acceptable=[]
        for row in sel['entries']:
            try: eligible(store,store.entry(row['id'])); acceptable.append(row)
            except Invalid as exc: selected['held'].append({'id':row['id'],'reason':str(exc)})
        sel['entries']=acceptable; sel['parallel']=sel['parallel'] and len(acceptable)>1
        if not acceptable: selected['selected']=None
    return selected

def start(store,e,agent_id='manager'):
    contract=eligible(store,e)
    if e['state']=='in-progress':
        rec=store.state['starts'].get(e['id'])
        require(rec and (e['phase']=='change' or rec['contract']==contract),'in-progress metadata missing/stale; reconcile, do not duplicate execution')
        return {'change':e['id'],'resumed':True,'snapshot':store.snapshot(e)}
    e['state']='in-progress'
    store.state['starts'][e['id']]={'contract':contract,'phase':e['phase'],'at':now(),'code':store.code(),'agent_id':agent_id}
    store.commit(); return {'change':e['id'],'snapshot':store.snapshot(e)}

def set_review(store,e,value,reference):
    store.active(e['id']); store.no_ticket(); decision(reference)
    require(e['phase']=='apply','change review applies only in apply phase')
    require(not any(r['change']==e['id'] for r in store.running()),'stop assigned agents before changing approval')
    if value=='approved':
        store.technical(e); fresh(store,e,'change')
        store.state['reviews'][e['id']]={'contract':store.contract(e),'decision_ref':reference,'at':now()}
    else: store.state['reviews'].pop(e['id'],None)
    e['review']=value; store.commit(); return {'change':e['id'],'review':value}

def advance(store,e,stage):
    store.active(e['id']); store.no_ticket()
    require(stage in ('change','apply'),'archive advancement requires archive-finalize; direct advance is prohibited')
    require(e['phase']==stage and e['state']=='in-progress','phase/state mismatch')
    require(not deps(store,e,stage),'; '.join(deps(store,e,stage)))
    store.technical(e); fresh(store,e,stage)
    if stage=='apply': complete(store,e)
    e['phase']='apply' if stage=='change' else 'archive'; e['state']='planned'
    if stage=='change': e['review']='pending'; store.state['reviews'].pop(e['id'],None)
    e.pop('blockers',None); store.commit()
    return {'change':e['id'],'phase':e['phase'],'state':e['state']}

def impact(store,ids):
    affected=set(ids)
    for cid in affected: store.entry(cid)
    while True:
        extra={e['id'] for e in store.plan['openspec'] if set(e.get('depends_on',[])) & affected}
        if extra<=affected: break
        affected |= extra
    return sorted(affected)

def reopen(store,ids,kind,reference):
    decision(reference); store.no_ticket(); affected=impact(store,ids); store.guard_history()
    require(not any(r['change'] in affected for r in store.running()),'stop and release affected native agents first')
    require(not any(r['change'] in affected and r['status']=='running' for r in store.state['repairs'].values()),'finish affected repair first')
    for cid in affected:
        e=store.active(cid)
        require(not (kind=='code' and cid in ids and e['phase']=='change'),'code reopen cannot skip change authoring')
    for bid,b in {b['id']:b for b in store.plan['batches']}.items():
        if any(cid in affected for w in b['waves'] for cid in w['openspec']): store.state['milestones'].pop(bid,None)
    for cid in affected:
        e=store.entry(cid)
        if kind!='code':
            e['revision']=e.get('revision',1)+1; e['phase']='change'; e.pop('review',None); store.state['reviews'].pop(cid,None)
        elif e['phase']!='change': e['phase']='apply'
        e['state']='planned'; e.pop('blockers',None)
        store.state['gates'].pop(cid,None); store.state['starts'].pop(cid,None)
    store.state.setdefault('revisions',[]).append({'at':now(),'kind':kind,'changes':affected,'decision_ref':reference})
    store.commit(); return {'affected':affected,'kind':kind}

def cancel(store,ids,reference):
    decision(reference); store.no_ticket()
    require(not any(r['change'] in ids for r in store.running()),'stop native agents before cancellation')
    require(not any(r['change'] in ids and r['status']=='running' for r in store.state['repairs'].values()),'finish repair before cancellation')
    for cid in ids: store.active(cid)
    for cid in ids:
        store.entry(cid)['state']='cancelled'; store.state['reviews'].pop(cid,None); store.state['gates'].pop(cid,None)
    store.state.setdefault('cancellations',[]).append({'changes':ids,'decision_ref':reference,'at':now()}); store.commit()
    return {'cancelled':ids}

def repair_begin(store,e,finding,allowed):
    store.no_ticket(); store.guard_history(); eligible(store,e)
    require(e['phase']=='apply' and e['state']=='in-progress','repair requires in-progress apply')
    require(not store.running() and not any(r['status']=='running' for r in store.state['repairs'].values()),'finish writers/repair before scoped repair')
    require(finding and allowed,'finding and explicit allowed paths required')
    allowed=[rel(p) for p in allowed]
    for p in allowed:
        store.file(p)
        require(p!='.' and not any(overlap(p,x) for x in PROTECTED) and 'snapshot' not in p.lower() and 'baseline' not in p.lower(), 'repair cannot modify product/spec/control/baseline paths')
    budget=f'{e["id"]}:{e.get("revision",1)}'
    attempts=store.state['repair_counts'].get(budget,0)
    require(attempts<2,'repair budget exhausted; new finding id does not reset budget')
    key=uid(); store.state['repair_counts'][budget]=attempts+1
    store.state['repairs'][key]={'key':key,'change':e['id'],'finding':finding,'allow':allowed,'contract':store.contract(e),'before':store.workspace(),'status':'running','attempt':attempts+1,'at':now()}
    store.commit(); return {'key':key,'attempt':attempts+1}

def repair_finish(store,key):
    r=store.state['repairs'].get(key); require(r,'unknown repair')
    if r['status']!='running': return {'ok':r['status']=='completed','status':r['status'],'idempotent':True}
    e=store.active(r['change']); changed=diff(r['before'],store.workspace())
    outside=[p for p in changed if not any(beneath(p,x) for x in r['allow'])]
    try: intact=store.contract(e)==r['contract']; store.guard_history()
    except Invalid: intact=False
    ok=bool(changed) and not outside and intact
    r.update(status='completed' if ok else 'failed',changed_files=changed,outside=outside,finished_at=now())
    if not ok: e['state']='blocked'; e['blockers']=['repair changed contract, exceeded scope, or made no progress']
    store.commit(); return {'ok':ok,'status':r['status'],'changed_files':changed,'outside':outside}

def fingerprint(store):
    return digest({'plan':{k:v for k,v in store.plan.items() if k not in ('current','updated_at')},'reviews':{k:v['contract'] for k,v in store.state['reviews'].items()},'gates':{cid:{stage:(r['status'],r['snapshot']) for stage,r in rs.items()} for cid,rs in store.state['gates'].items()},'tasks':{k:r['status'] for k,r in store.state['claims'].items()},'repair_counts':store.state['repair_counts']})

def resolve_planning(store, requested=None):
    """Resolve request precedence only; the Agent judges uncertainty, not Python."""
    path=store.file('manager/policy.yaml')
    data=parse(path.read_text()) if path.exists() else {}
    require(isinstance(data,dict),'manager/policy.yaml must be a mapping')
    configured=data.get('planning')
    modes=('auto','full','rolling')
    require('planning' not in data or configured in modes,'policy.planning must be auto/full/rolling')
    require(requested is None or requested in modes,'planning must be auto/full/rolling')
    if requested is not None: return {'requested':requested,'source':'user'}
    if configured is not None: return {'requested':configured,'source':'project'}
    return {'requested':'auto','source':'auto'}


def session_open(store,batches,rounds,reference):
    decision(reference); store.no_ticket(); require(type(rounds) is int and rounds>0,'positive max-rounds required')
    known={b['id']:b for b in store.plan['batches']}
    require(batches and len(batches)==len(set(batches)) and set(batches)<=set(known),'unknown/empty/duplicate session batch scope')
    key=uid(); store.state['sessions'][key]={'id':key,'batches':batches,'scope_hash':digest([known[x] for x in batches]),'max_rounds':rounds,'rounds':0,'open_round':None,'status':'active','decision_ref':reference,'checkpoints':{},'at':now()}
    store.commit(); return {'session':key,'max_rounds':rounds,'batches':batches}


def session_scope(store,session):
    known={b['id']:b for b in store.plan['batches']}
    require(all(x in known for x in session['batches']) and digest([known[x] for x in session['batches']])==session['scope_hash'],'session scope changed; explicit new authorization needed')
    return known


def checkpoint(store,session,batch,rows):
    """A technical checkpoint never creates a human product-acceptance record."""
    bid=batch['id']; mode=batch.get('checkpoint','manual')
    require(mode in ('manual','auto'),'checkpoint must be manual/auto')
    require(mode!='auto' or not any(e.get('risk')=='high' for e in rows),'high-risk batch requires manual checkpoint')
    saved=session.setdefault('checkpoints',{}).get(bid)
    milestone=store.state['milestones'].get(bid)
    if mode=='manual':
        require(milestone,'milestone product acceptance pending')
        if saved: require(saved.get('milestone_hash')==digest(milestone),'milestone acceptance changed; explicit new session needed')
    snapshots={}
    for e in rows:
        if e['phase']=='done':
            require(store.proof(e['id']),'milestone completion proof missing/changed')
            actual=store.state['completed'][e['id']]['contract']
        else:
            # First crossing verifies the current integration. Subsequent rounds
            # consume the verified contract, not the obsolete whole-repo code hash.
            fresh(store,e,'apply',prerequisite=bool(saved))
            actual=store.snapshot(e)
        expected=(saved or milestone or {}).get('snapshots',{}).get(e['id'])
        contract=actual.get('contract') if isinstance(actual,dict) else actual
        if saved:
            previous=expected.get('contract') if isinstance(expected,dict) else expected
            require(previous==contract,'checkpoint contract changed; explicit new session needed')
        elif mode=='manual':
            if e['phase']=='done':
                previous=expected.get('contract') if isinstance(expected,dict) else expected
                require(previous==contract,'milestone completion proof changed')
            else: require(expected==actual,'milestone acceptance stale')
        snapshots[e['id']]=actual
    if not saved:
        session['checkpoints'][bid]={'at':now(),'mode':mode,'snapshots':snapshots,'decision_ref':session['decision_ref'],'milestone_hash':digest(milestone) if mode=='manual' else None}


def session_next(store,session,known):
    """Select only frozen, authorized batches; never plan, approve or archive."""
    for bid in session['batches']:
        batch=known[bid]
        rows=[store.entry(cid) for w in batch['waves'] for cid in w['openspec']]
        if any(e.get('state') in ('blocked','cancelled') for e in rows):
            return None,'blocked',[{'batch':bid,'reason':'blocked/cancelled work needs explicit resolution'}]
        if rows and all(e['phase'] in ('archive','done') for e in rows):
            try: checkpoint(store,session,batch,rows)
            except Invalid as exc:
                reason='milestone' if str(exc)=='milestone product acceptance pending' else 'held'
                return None,reason,[{'batch':bid,'reason':str(exc)}]
            if batch.get('planning_boundary'):
                return None,'planning-boundary',[{'batch':bid,'reason':batch['planning_boundary']}]
            continue
        session.setdefault('checkpoints',{}).pop(bid,None)
        result=next_work(store,'auto',bid)
        if result['selected']: return result['selected'],None,result['held']
        if result['held']: return None,'held',result['held']
    return None,'no-work',[]


def round_begin(store,key):
    s=store.state['sessions'].get(key); require(s,'unknown session')
    require(s['status']=='active','session stopped; do not implicitly reopen')
    require(s['open_round'] is None,'unfinished round: reconcile original threads then round-finish')
    require(s['rounds']<s['max_rounds'],'session budget exhausted')
    known=session_scope(store,s)
    selection,reason,held=session_next(store,s,known)
    if not selection:
        s['status']='stopped'; s['last_footer']=f'MANAGER-RUN: STOP({reason})'
        store.commit(); return {'footer':s['last_footer'],'held':held}
    s['rounds']+=1; s['open_round']={'before':fingerprint(store),'selection':selection,'at':now()}
    store.commit(); return {'selection':selection,'round':s['rounds']}


def round_finish(store,key):
    s=store.state['sessions'].get(key); require(s and s['open_round'],'no open round')
    selected=s['open_round']['selection']; rows=[store.entry(e['id']) for e in selected['entries']]
    require(not any(r['change'] in {e['id'] for e in rows} for r in store.running()),'reconcile/stop running agents before finishing the round')
    held=[]
    if any(e.get('state') in ('blocked','cancelled') for e in rows): reason='blocked'
    elif s['open_round']['before']==fingerprint(store): reason='no-progress'
    elif any(e['phase']=='apply' and e.get('review')!='approved' for e in rows): reason='boundary'
    elif s['rounds']>=s['max_rounds']: reason='budget'
    else:
        try: _,reason,held=session_next(store,s,session_scope(store,s))
        except Invalid as exc: reason='held'; held=[{'reason':str(exc)}]
    s['open_round']=None
    if reason: s['status']='stopped'
    footer=f'MANAGER-RUN: STOP({reason})' if reason else 'MANAGER-RUN: CONTINUE'
    s['last_footer']=footer; store.commit(); return {'footer':footer,'round':s['rounds'],'held':held,'checkpoints':list(s.get('checkpoints',{}))}

def approve_milestone(store,batch,reference):
    decision(reference); b=next((b for b in store.plan['batches'] if b['id']==batch),None); require(b,'unknown batch')
    snapshots={}
    for w in b['waves']:
        for cid in w['openspec']:
            e=store.entry(cid); require(e.get('state')!='cancelled','cancelled work needs explicit revised milestone scope')
            require(e['phase'] in ('archive','done'),'milestone implementation not complete')
            if e['phase']=='done': require(store.proof(cid),'invalid completion proof'); snapshots[cid]=store.state['completed'][cid]['contract']
            else: fresh(store,e,'apply'); snapshots[cid]=store.snapshot(e)
    store.state['milestones'][batch]={'snapshots':snapshots,'decision_ref':reference,'at':now()}; store.commit(); return {'approved_milestone':batch}

def doctor(store):
    errors=[]; warnings=[]; roles=[]
    try: store.policy(); resolve_planning(store)
    except Invalid as exc: errors.append(str(exc))
    p=store.file('manager/roles.yaml')
    if not p.exists(): errors.append('missing manager/roles.yaml')
    else:
        data=parse(p.read_text()); require(isinstance(data,dict) and isinstance(data.get('routes'),dict),'roles.routes must be a mapping')
        def walk(node):
            if isinstance(node,dict):
                if 'agent_type' in node: roles.append(node['agent_type'])
                if 'fallback' in node: roles.append(node['fallback'])
                for value in node.values(): walk(value)
            elif isinstance(node,list):
                for value in node: walk(value)
        walk(data)
        for role in sorted(set(roles)):
            try: role_definition(store,role)
            except (Invalid,tomllib.TOMLDecodeError) as exc: errors.append(str(exc))
    for e in store.plan['openspec']:
        if e['phase']=='done' or e.get('state')=='cancelled': continue
        try: execution(store,e)
        except Invalid as exc: errors.append(str(exc))
    for executable in ('codex','openspec'):
        if not shutil.which(executable): warnings.append(f'{executable} not found; native/CLI end-to-end not verified')
    try: store.guard_history()
    except Invalid as exc: errors.append(str(exc))
    return {'ok':not errors,'version':VERSION,'errors':errors,'warnings':warnings,'roles':sorted(set(roles)),'native_execution':'unverified'}
