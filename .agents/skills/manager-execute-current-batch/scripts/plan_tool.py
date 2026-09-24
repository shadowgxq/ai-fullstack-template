#!/usr/bin/env python3
"""Manager v2 control CLI. See --help and --capabilities for its actual contract."""
from __future__ import annotations
import argparse
from copy import deepcopy
import json
from pathlib import Path
import sys
import yaml
from manager_schema import VERSION, SCOPES, Invalid, parse, require, select_next, validate
from manager_store import Store, encoded, lock, now
from plan_inputs import InputError, input_issues, normalize_inputs, resolve_inputs
import manager_archive as archive
import manager_flow as flow
import manager_gate as gate
import manager_tasks as tasks
from manager_roles import describe_role

COMMANDS = ('resolve-role','resolve-planning','validate','next','start','advance','block','set-review','repoint-current','resolve-inputs','inputs','normalize-inputs','compact','doctor','approve-technical','snapshot','task-ready','task-claim','task-finish','task-release','gate-run','impact','reopen','cancel','repair-begin','repair-finish','session-open','round-begin','round-finish','approve-milestone','seal-archives','archive-prepare','archive-finalize','archive-abort','prune','recover','completion-import')

def parser():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--plan',default='manager/plan.yaml'); p.add_argument('--root'); p.add_argument('--capabilities',action='store_true')
    sub=p.add_subparsers(dest='command')
    def add(name,change=False,decide=False,multiple=False):
        s=sub.add_parser(name)
        if change: s.add_argument('--change',required=True,nargs='+' if multiple else None)
        if decide: s.add_argument('--decision-ref',required=True)
        return s
    s=add('resolve-role'); s.add_argument('--role',required=True)
    s=add('resolve-planning'); s.add_argument('--planning',choices=('auto','full','rolling'))
    s=add('validate'); s.add_argument('--strict-inputs',action='store_true')
    s=add('next'); s.add_argument('--scope',choices=SCOPES,default='auto'); s.add_argument('--batch')
    s=add('start',True); s.add_argument('--agent-id',default='manager')
    s=add('advance',True); s.add_argument('--completed',choices=('change','apply','archive'),required=True)
    s=add('block',True); s.add_argument('--reason',required=True)
    s=add('set-review',True,True); s.add_argument('--review',choices=('approved','pending'),required=True)
    add('repoint-current')
    for name in ('resolve-inputs','inputs'): add(name,True)
    s=add('normalize-inputs'); s.add_argument('--output')
    s=add('compact'); s.add_argument('--write',action='store_true')
    add('doctor'); add('recover')
    s=add('approve-technical',decide=True); s.add_argument('--document',required=True); s.add_argument('--source',required=True,nargs='+')
    for name in ('snapshot','task-ready'): add(name,True)
    s=add('task-claim',True); s.add_argument('--task',required=True); s.add_argument('--agent-id',required=True)
    s=add('task-finish'); s.add_argument('--run-id',required=True); s.add_argument('--result',required=True)
    s=add('task-release',decide=True); s.add_argument('--run-id',required=True); s.add_argument('--agent-stopped',action='store_true')
    s=add('gate-run',True); s.add_argument('--stage',required=True,choices=('change','apply')); s.add_argument('--review-file')
    add('impact',True,multiple=True)
    s=add('reopen',True,True,True); s.add_argument('--kind',choices=('code','design','requirement'),required=True)
    add('cancel',True,True,True)
    s=add('repair-begin',True); s.add_argument('--finding',required=True); s.add_argument('--allow',required=True,nargs='+')
    s=add('repair-finish'); s.add_argument('--key',required=True)
    s=add('session-open',decide=True); s.add_argument('--batch',nargs='+',required=True); s.add_argument('--max-rounds',type=int,default=12)
    for name in ('round-begin','round-finish'): add(name).add_argument('--session',required=True)
    add('approve-milestone',decide=True).add_argument('--batch',required=True)
    add('seal-archives',decide=True)
    add('archive-prepare',True,True)
    s=add('archive-finalize'); s.add_argument('--ticket',required=True); s.add_argument('--destination',required=True)
    add('archive-abort',decide=True).add_argument('--ticket',required=True)
    add('prune',True,True,True)
    add('completion-import',True,True).add_argument('--destination',required=True)
    return p

def readonly(args):
    path=Path(args.plan); require(path.is_file(),f'missing plan: {path}')
    completed=set()
    if (path.parent/'runtime/state.json').exists():
        store=Store(path,args.root)
        # Read-only validators may be subprocesses of gate-run, which owns the
        # writer lock. Do not acquire that lock recursively or modify runtime.
        require(not store.journal.exists(),'transaction pending; retry validation after recovery')
        store.load(); plan=store.plan; completed=store.valid_completions()
        require(not store.journal.exists() and store.path.read_bytes()==store.before_plan and store.state_path.read_bytes()==store.before_state,'state changed during validation; retry')
    else: plan=parse(path.read_text())
    errors,warnings=validate(plan,strict_inputs=getattr(args,'strict_inputs',False),completed_ids=completed)
    if args.command=='validate': return {'ok':not errors,'errors':errors,'warnings':warnings,'version':VERSION}
    require(not errors,'; '.join(errors))
    if args.command in ('resolve-inputs','inputs'):
        e=next((e for e in plan['openspec'] if e['id']==args.change),None); require(e is not None,'unknown change')
        return {'change':e['id'],'inputs':resolve_inputs(plan,e),'technical_design':e.get('technical_design',[]),'ui_baseline':e.get('ui_baseline')}
    normalized,report=normalize_inputs(plan)
    if args.output:
        target=Path(args.output)
        require(target.absolute()!=path.absolute(),'will not overwrite active plan')
        with target.open('x',encoding='utf-8') as file: yaml.safe_dump(normalized,file,sort_keys=False,allow_unicode=True)
    return {'plan':normalized,'report':report,'written_to':args.output}

def execute(s,a):
    cmd=a.command
    if cmd=='doctor': return flow.doctor(s)
    if cmd=='recover': return {'recovered':True}
    if cmd=='approve-technical': return flow.approve(s,a.document,a.source,a.decision_ref)
    if cmd=='next': return flow.next_work(s,a.scope,a.batch)
    if cmd=='compact':
        preview=deepcopy(s.plan); preview['version']=2; preview.pop('updated_at',None)
        preview['current']={k:v for k,v in preview.get('current',{}).items() if k in ('batch','wave')}
        for e in preview['openspec']:
            for k,v in (('path',f'openspec/changes/{e["id"]}'),('tasks',f'openspec/changes/{e["id"]}/tasks.md')):
                if e.get(k)==v: e.pop(k)
            for k in ('inputs','input_refs','depends_on'):
                if e.get(k)==[]: e.pop(k)
        if a.write:
            s.no_ticket(); backup=f'manager/runtime/backups/plan-{now().replace(":","-")}.yaml'; s.plan=preview; s.commit({backup:s.before_plan})
        return {'plan':preview,'written':a.write}
    if cmd=='repoint-current':
        result=flow.next_work(s)['selected']; s.plan['current']={'batch':result['batch'],'wave':result['wave']} if result else {}; s.commit(); return {'current':s.plan['current']}
    if cmd=='set-review': return flow.set_review(s,s.active(a.change),a.review,a.decision_ref)
    if cmd=='start': return flow.start(s,s.active(a.change),a.agent_id)
    if cmd=='advance': return flow.advance(s,s.active(a.change),a.completed)
    if cmd=='block':
        s.no_ticket(); e=s.active(a.change); e['state']='blocked'; e.setdefault('blockers',[]).append(a.reason); s.commit(); return {'blocked':a.change}
    if cmd=='snapshot': return s.snapshot(s.active(a.change))
    if cmd=='task-ready': flow.eligible(s,s.active(a.change)); return tasks.ready(s,s.entry(a.change))
    if cmd=='task-claim': flow.eligible(s,s.active(a.change)); return tasks.claim(s,s.entry(a.change),a.task,a.agent_id)
    if cmd=='task-finish': return tasks.finish(s,a.run_id,a.result)
    if cmd=='task-release': return tasks.release(s,a.run_id,a.agent_stopped,a.decision_ref)
    if cmd=='gate-run': return gate.run(s,s.active(a.change),a.stage,a.review_file)
    if cmd=='impact': return {'affected':flow.impact(s,a.change)}
    if cmd=='reopen': return flow.reopen(s,a.change,a.kind,a.decision_ref)
    if cmd=='cancel': return flow.cancel(s,a.change,a.decision_ref)
    if cmd=='repair-begin': return flow.repair_begin(s,s.active(a.change),a.finding,a.allow)
    if cmd=='repair-finish': return flow.repair_finish(s,a.key)
    if cmd=='session-open': return flow.session_open(s,a.batch,a.max_rounds,a.decision_ref)
    if cmd=='round-begin': return flow.round_begin(s,a.session)
    if cmd=='round-finish': return flow.round_finish(s,a.session)
    if cmd=='approve-milestone': return flow.approve_milestone(s,a.batch,a.decision_ref)
    if cmd=='seal-archives': return archive.seal(s,a.decision_ref)
    if cmd=='archive-prepare': return archive.prepare(s,s.active(a.change),a.decision_ref)
    if cmd=='archive-finalize': return archive.finalize(s,a.ticket,a.destination)
    if cmd=='archive-abort': return archive.abort(s,a.ticket,a.decision_ref)
    if cmd=='prune': return archive.prune(s,a.change,a.decision_ref)
    if cmd=='completion-import': return archive.import_completion(s,a.change,a.destination,a.decision_ref)
    raise Invalid(f'unsupported command: {cmd}')

def main(argv=None):
    a=parser().parse_args(argv)
    if a.capabilities:
        print(json.dumps({'version':VERSION,'plan_versions':[1,2],'commands':list(COMMANDS)})); return 0
    if not a.command: parser().error('a command is required')
    try:
        if a.command=='resolve-role':
            result=describe_role(Store(a.plan,a.root),a.role)
        elif a.command=='resolve-planning':
            result=flow.resolve_planning(Store(a.plan,a.root),a.planning)
        elif a.command in ('validate','resolve-inputs','inputs','normalize-inputs'):
            result=readonly(a)
        else:
            s=Store(a.plan,a.root)
            with lock(s.file('manager/runtime/control.lock')):
                s.recover(); s.load(allow_empty=a.command in ('doctor','approve-technical'),migration_id=a.change if a.command=='completion-import' else None); result=execute(s,a)
        print(json.dumps(result,ensure_ascii=False,indent=2,default=str))
        return 0 if result.get('ok',True) else 1
    except (Invalid,InputError,OSError,ValueError,TypeError) as exc:
        print(json.dumps({'ok':False,'error':str(exc)},ensure_ascii=False),file=sys.stderr); return 1

if __name__=='__main__': raise SystemExit(main())
