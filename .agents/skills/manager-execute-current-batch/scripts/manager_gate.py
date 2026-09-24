"""Execute actual checks and bind evidence to the integrated code/contract snapshot."""
from __future__ import annotations
import os
import re
import signal
import subprocess
from pathlib import Path
from manager_schema import Invalid, parse, require
from manager_store import digest, now, uid
from manager_tasks import complete, diff


def check_command(store,argv,timeout):
    require(isinstance(argv,list) and argv and all(isinstance(a,str) and a for a in argv),'check must be argv, not shell')
    key=uid(); output=store.file(f'manager/runtime/logs/{key}.log'); output.parent.mkdir(parents=True,exist_ok=True)
    status='failed'; code=None
    with output.open('wb') as out:
        try:
            process=subprocess.Popen(argv,cwd=store.root,stdout=out,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=(os.name!='nt'))
            try:
                code=process.wait(timeout=timeout); status='passed' if code==0 else 'failed'
            except subprocess.TimeoutExpired:
                if os.name!='nt': os.killpg(process.pid,signal.SIGKILL)
                else: process.kill()
                process.wait(); status='timeout'
        except OSError as exc:
            out.write(f'{type(exc).__name__}: {exc}\n'.encode())
    return {'argv':argv,'status':status,'exit_code':code,'log':str(output.relative_to(store.root)),'log_sha256':digest(output.read_bytes())}


def review(store,e,path,snapshot):
    file=store.file(path); require(file.is_file(),'independent review file missing')
    report=parse(file.read_text()); require(isinstance(report,dict),'review must be an object')
    require(report.get('snapshot')==snapshot,'review is for different code/contract/revision')
    who=report.get('reviewer_agent_id'); require(isinstance(who,str) and who.strip(),'reviewer identity missing')
    authors={r['agent_id'] for r in store.state['claims'].values() if r['change']==e['id']}
    authors.add(store.state['starts'].get(e['id'],{}).get('agent_id','manager'))
    require(who not in authors,'implementation author cannot be independent reviewer')
    findings=report.get('findings'); require(isinstance(findings,list),'review findings list required')
    for f in findings:
        require(isinstance(f,dict) and f.get('severity') in ('critical','blocker','warning','suggestion') and f.get('description'),'invalid review finding')
    require(not any(f['severity'] in ('critical','blocker') for f in findings),'blocking review findings')
    paths=report.get('evidence'); require(isinstance(paths,list) and paths,'review evidence required')
    for p in paths:
        require(isinstance(p,str) and store.file(p).is_file() and store.file(p).stat().st_size>0,'review evidence must be a nonempty file')
    evidence={p:store.source({'source':p}) for p in paths}
    started=store.state['starts'].get(e['id'],{})
    changed=diff(started.get('code',{}),store.code())
    ui_needed='ui' in e.get('impacts',[]) or any(re.search(r'\.(tsx|jsx|vue|svelte|html|css|scss)$',p) for p in changed)
    if ui_needed:
        baseline=e.get('ui_baseline'); require(baseline,'UI change needs an approved ui_baseline')
        store.document_approval(baseline,store.requirements(e))
        ui=report.get('ui',{}); require(isinstance(ui,dict) and ui.get('decision_ref'),'UI acceptance decision reference required')
        screenshots=ui.get('screenshots',[]); interactions=ui.get('interaction_evidence')
        require(isinstance(screenshots,list) and screenshots and interactions,'UI screenshot and interaction evidence required')
        for p in screenshots:
            f=store.file(p); require(f.suffix.lower() in ('.png','.jpg','.jpeg','.webp') and f.is_file() and f.stat().st_size>0,'missing/empty screenshot')
            evidence[p]=store.source({'source':p})
        require(isinstance(interactions,str) and store.file(interactions).is_file() and store.file(interactions).stat().st_size>0,'UI interaction evidence must be a nonempty file')
        evidence[interactions]=store.source({'source':interactions})
    return {'reviewer_agent_id':who,'report':str(file.relative_to(store.root)),'report_sha256':digest(file.read_bytes()),'evidence':evidence,'ui_required':ui_needed}


def fresh(store,e,stage,prerequisite=False):
    receipt=store.state['gates'].get(e['id'],{}).get(stage)
    require(receipt and receipt.get('status')=='passed',f'{stage} gate has not passed')
    actual=store.snapshot(e)
    keys=('change','revision','contract') if prerequisite else tuple(actual)
    require(all(receipt['snapshot'].get(k)==actual[k] for k in keys),'gate stale: code, sources, policy or contract changed')
    store.guard_history()
    for c in receipt['checks']:
        p=store.file(c['log']); require(p.is_file() and digest(p.read_bytes())==c['log_sha256'],'check log missing or modified')
    r=receipt.get('review')
    if r:
        p=store.file(r['report']); require(p.is_file() and digest(p.read_bytes())==r['report_sha256'],'review report modified')
        for source, expected in r['evidence'].items(): require(store.source({'source':source})==expected,'review evidence missing or modified')
    if prerequisite:
        require(not any(r['change']==e['id'] for r in store.running()), 'dependency still has a running writer')
        require(not any(r['status']=='running' and r['change']==e['id'] for r in store.state['repairs'].values()), 'dependency repair still running')
    else:
        require(not store.running(), 'integration gate requires all writers stopped')
        require(not any(r['status']=='running' for r in store.state['repairs'].values()),'repair still running')
    return receipt


def run(store,e,stage,review_file=None):
    store.no_ticket(); store.guard_history(); policy=store.policy()
    reverify=stage=='apply' and e['phase']=='archive' and e.get('state')=='planned'
    require(reverify or (e['phase']==stage and e['state']=='in-progress'),'gate must run in matching in-progress phase or reverify archive-ready apply')
    require(not store.running(),'finish all claims before integrated gate')
    require(not any(r['status']=='running' for r in store.state['repairs'].values()),'finish repair before gate')
    store.technical(e)
    if stage=='apply':
        r=store.state['reviews'].get(e['id']); require(r and r['contract']==store.contract(e),'fresh change review approval required')
        complete(store,e)
    snapshot=store.snapshot(e); evidence=None
    try:
        if stage=='apply':
            require(review_file,'independent --review-file required'); evidence=review(store,e,review_file,snapshot)
        # The structural OpenSpec gate is not removable through policy configuration.
        commands=[['openspec','validate',e['id'],'--strict','--no-interactive']]+policy['checks'].get(stage,[])
        checks=[check_command(store,[part.replace('{change}',e['id']) for part in cmd],policy.get('timeout_seconds',300)) for cmd in commands]
        ok=all(c['status']=='passed' for c in checks)
        require(store.snapshot(e)==snapshot,'workspace changed while checks were running')
        store.guard_history()
        error=None
    except Invalid as exc:
        checks=locals().get('checks',[]); ok=False; error=str(exc)
    rec={'id':uid(),'at':now(),'snapshot':snapshot,'status':'passed' if ok else 'failed','checks':checks,'review':evidence,'error':error}
    store.state['gates'].setdefault(e['id'],{})[stage]=rec
    store.commit()
    return {'ok':ok,'receipt':rec}
