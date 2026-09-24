"""Manager control integration regressions. Native agents are NOT simulated as real.

The default fixture's openspec executable is a deterministic subprocess test double.
Set MANAGER_LIVE_OPENSPEC=1 for the separate live CLI integration test in CI.
"""
from __future__ import annotations
from copy import deepcopy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import yaml

ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/'manager-execute-current-batch/scripts'
sys.path.insert(0,str(SCRIPTS))
from manager_schema import Invalid, parse, select_next, validate
from manager_store import Store, atomic, decode, digest, encoded, lock
import manager_flow as flow
import manager_gate as gate
import manager_archive as archive
import manager_tasks as tasks
import plan_tool

FAKE = '''#!/usr/bin/env python3
import os, pathlib, shutil, sys, time
root=pathlib.Path.cwd()
if os.environ.get('TEST_OPENSPEC_TIMEOUT'): time.sleep(5)
if os.environ.get('TEST_OPENSPEC_FAIL'): sys.exit(3)
if len(sys.argv)>1 and sys.argv[1]=='archive':
    cid=sys.argv[2]; source=root/'openspec/changes'/cid
    target=root/'openspec/changes/archive'/('2026-09-22-'+cid)
    target.parent.mkdir(parents=True,exist_ok=True)
    (root/'openspec/specs/example').mkdir(parents=True,exist_ok=True)
    (root/'openspec/specs/example/spec.md').write_text('# Example\\n')
    shutil.move(str(source),str(target))
print('subprocess fixture; not the real OpenSpec CLI')
'''

class Project:
    def __init__(self,root,live=False):
        self.root=Path(root); self.plan_path=self.root/'manager/plan.yaml'; self.live=live
        self.write('docs/prd/example.md','# Requirement R1\nThe user can read an example.\n')
        self.write('docs/technical/example.md','# Technical design\nThe example endpoint is deterministic.\n')
        self.write('src/api.py','def example(): return 1\n')
        self.write('manager/policy.yaml',yaml.safe_dump({'version':2,'max_agents':4,'max_writers':2,'timeout_seconds':2 if not live else 60,'checks':{'change':[],'apply':[[sys.executable,'-c','print("project check executed")']]}}))
        self.write('manager/roles.yaml','routes:\n  change:\n    agent_type: architect\n  apply:\n    agent_type: backend-dev\n  verify:\n    agent_type: reviewer\n')
        for role in ('architect','backend-dev','frontend-dev','qa','reviewer'):
            self.write(f'.codex/agents/{role}.toml',f'name = "{role}"\ndescription = "Fixture role"\nmodel = "fixture-model-not-a-real-invocation"\ndeveloper_instructions = "Only act on the assigned test."\n')
        self.write('openspec/config.yaml','schema: spec-driven\n')
        self.plan={'version':2,'requirements':[{'id':'req-one','source':'docs/prd/example.md','acceptance':['User can read an example']}],'openspec':[],'batches':[]}
        self.add('example')
        if not live:
            self.write('bin/openspec',FAKE); (self.root/'bin/openspec').chmod(0o755)
            self.env=patch.dict(os.environ,{'PATH':str(self.root/'bin')+os.pathsep+os.environ.get('PATH','')})
            self.env.start()
    def close(self):
        if not self.live: self.env.stop()
    def write(self,path,text):
        p=self.root/path; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(text); return p
    def save(self): self.write('manager/plan.yaml',yaml.safe_dump(self.plan,sort_keys=False))
    def add(self,cid,deps=(),batch=None):
        e={'id':cid,'phase':'change','state':'planned','requirements':['req-one'],'technical_design':['docs/technical/example.md'],'depends_on':list(deps)}
        self.plan['openspec'].append(e)
        if not self.plan['batches'] or batch:
            self.plan['batches'].append({'id':batch or 'm1','waves':[{'id':'main','parallel':True,'openspec':[cid]}]})
        else: self.plan['batches'][0]['waves'][0]['openspec'].append(cid)
        self.save()
        self.write(f'openspec/changes/{cid}/.openspec.yaml','schema: spec-driven\n')
        self.write(f'openspec/changes/{cid}/proposal.md','# Example\n\n## Why\nProvide an example.\n\n## What Changes\nAdd example behavior.\n\n## Capabilities\n### New Capabilities\n- `example`: read an example.\n\n## Impact\nLocal source and tests.\n')
        self.write(f'openspec/changes/{cid}/design.md','## Context\nExample design.\n## Decisions\nReturn a fixed value.\n')
        self.write(f'openspec/changes/{cid}/specs/example/spec.md','## Purpose\nProvide a deterministic example response so callers can verify behavior, integrations and lifecycle controls without external dependencies.\n\n## ADDED Requirements\n\n### Requirement: Example response\nThe system SHALL return the example value.\n\n#### Scenario: Read example\n- **WHEN** the user requests an example\n- **THEN** the example value is returned\n')
        self.write(f'openspec/changes/{cid}/tasks.md','## Implementation\n- [ ] T1 Implement example\n')
        return e
    def store(self):
        s=Store(self.plan_path); s.recover(); s.load(); return s
    def approved(self):
        s=self.store(); flow.approve(s,'docs/technical/example.md',['docs/prd/example.md'],'test-only human approval'); return self.store()
    def change_done(self,cid='example'):
        s=self.approved(); flow.start(s,s.entry(cid),'implementer')
        self.assert_ok(gate.run(s,s.entry(cid),'change'))
        flow.advance(s,s.entry(cid),'change'); flow.set_review(s,s.entry(cid),'approved','test-only artifact approval')
        return self.store()
    def apply_started(self,cid='example'):
        s=self.change_done(cid); flow.start(s,s.entry(cid),'implementer'); return self.store()
    def report(self,s,cid='example',**extra):
        self.write('manager/runtime/evidence/check.txt','test fixture evidence, no native agent invocation\n')
        obj={'snapshot':s.snapshot(s.entry(cid)),'reviewer_agent_id':'reviewer-test','findings':[],'evidence':['manager/runtime/evidence/check.txt'],**extra}
        path=f'manager/runtime/evidence/review-{cid}.json'
        self.write(path,json.dumps(obj)); return path
    def archive_ready(self,cid='example'):
        s=self.apply_started(cid); self.write(f'openspec/changes/{cid}/tasks.md','## Implementation\n- [x] T1 Implement example\n')
        report=self.report(s,cid); self.assert_ok(gate.run(s,s.entry(cid),'apply',report)); flow.advance(s,s.entry(cid),'apply'); return self.store()
    def archived(self,cid='example'):
        s=self.archive_ready(cid); rec=archive.prepare(s,s.entry(cid),'test archive permission')
        subprocess.run(rec['operator_command'],cwd=self.root,check=True,capture_output=True)
        dest=next((self.root/'openspec/changes/archive').glob('*-'+cid))
        archive.finalize(s,rec['ticket'],str(dest.relative_to(self.root))); return self.store(),rec
    def graph(self,defs):
        self.write('openspec/changes/example/execution.yaml',yaml.safe_dump({'tasks':defs}))
        self.write('openspec/changes/example/tasks.md','## Implementation\n'+''.join(f'- [ ] {t["id"]} Implement {t["id"]}\n' for t in defs))
    @staticmethod
    def assert_ok(result):
        if not result.get('ok',True): raise AssertionError(result)
    def cli(self,*args):
        return subprocess.run([sys.executable,str(SCRIPTS/'plan_tool.py'),'--plan',str(self.plan_path),*args],cwd=self.root,text=True,capture_output=True,timeout=15)

def task(tid='T1',**kwargs): return {'id':tid,'role':'backend-dev','needs':[],'reads':[],'writes':['src/a'],'resources':[],'acceptance':['Result works'],**kwargs}

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.p=Project(self.tmp.name)
    def tearDown(self): self.p.close(); self.tmp.cleanup()
    def test_capabilities_cover_documented_v2(self):
        result=self.p.cli('--capabilities'); self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue({'doctor','approve-technical','task-claim','gate-run','archive-finalize','session-open'}<=set(json.loads(result.stdout)['commands']))
        actions=plan_tool.parser()._subparsers._group_actions[0].choices
        self.assertEqual(set(actions),set(plan_tool.COMMANDS))
    def test_start_cannot_bypass_human_technical_approval(self):
        s=self.p.store(); before=self.p.plan_path.read_bytes()
        with self.assertRaisesRegex(Invalid,'unapproved'): flow.start(s,s.entry('example'))
        self.assertEqual(before,self.p.plan_path.read_bytes())
    def test_approval_binds_document_and_prd(self):
        self.p.approved(); self.p.write('docs/prd/example.md','Changed behavior')
        s=self.p.store()
        with self.assertRaisesRegex(Invalid,'source changed'): flow.start(s,s.entry('example'))
    def test_wrong_source_approval_not_accepted(self):
        self.p.write('docs/prd/other.md','Other')
        s=self.p.store(); flow.approve(s,'docs/technical/example.md',['docs/prd/other.md'],'test')
        with self.assertRaisesRegex(Invalid,'cover PRD'): flow.start(s,s.entry('example'))
    def test_legacy_approved_string_not_a_receipt(self):
        self.p.plan['openspec'][0].update(phase='apply',review='approved'); self.p.save(); s=self.p.approved()
        with self.assertRaisesRegex(Invalid,'approval missing'): flow.start(s,s.entry('example'))
    def test_advance_requires_real_gate(self):
        s=self.p.approved(); flow.start(s,s.entry('example'))
        with self.assertRaisesRegex(Invalid,'gate has not passed'): flow.advance(s,s.entry('example'),'change')
    def test_old_gate_rejected_after_code_change(self):
        s=self.p.approved(); flow.start(s,s.entry('example')); self.assertTrue(gate.run(s,s.entry('example'),'change')['ok'])
        self.p.write('src/new.py','changed')
        with self.assertRaisesRegex(Invalid,'stale'): flow.advance(s,s.entry('example'),'change')
    def test_changed_shared_input_invalidates_gate(self):
        self.p.write('docs/api/contract.md','old')
        self.p.plan['inputs']=[{'id':'api','kind':'api-contract','source':'docs/api/contract.md','required':True}]
        self.p.plan['openspec'][0]['input_refs']=['api']; self.p.save()
        s=self.p.approved(); flow.start(s,s.entry('example')); self.assertTrue(gate.run(s,s.entry('example'),'change')['ok'])
        self.p.write('docs/api/contract.md','new')
        with self.assertRaisesRegex(Invalid,'stale'): flow.advance(s,s.entry('example'),'change')
    def test_failed_subprocess_is_failed_gate(self):
        s=self.p.approved(); flow.start(s,s.entry('example'))
        with patch.dict(os.environ,{'TEST_OPENSPEC_FAIL':'1'}): result=gate.run(s,s.entry('example'),'change')
        self.assertFalse(result['ok']); self.assertEqual(result['receipt']['checks'][0]['exit_code'],3)
    def test_timeout_is_not_pass(self):
        policy=parse((self.p.root/'manager/policy.yaml').read_text()); policy['timeout_seconds']=1
        self.p.write('manager/policy.yaml',yaml.safe_dump(policy)); s=self.p.approved(); flow.start(s,s.entry('example'))
        with patch.dict(os.environ,{'TEST_OPENSPEC_TIMEOUT':'1'}): result=gate.run(s,s.entry('example'),'change')
        self.assertFalse(result['ok']); self.assertEqual(result['receipt']['checks'][0]['status'],'timeout')
    def test_gate_missing_independent_review(self):
        s=self.p.apply_started(); self.p.write('openspec/changes/example/tasks.md','## Implementation\n- [x] T1 Implement example\n')
        self.assertFalse(gate.run(s,s.entry('example'),'apply')['ok'])
    def test_author_cannot_review_self(self):
        s=self.p.apply_started(); self.p.write('openspec/changes/example/tasks.md','## Implementation\n- [x] T1 Implement example\n')
        r=self.p.report(s,reviewer_agent_id='implementer'); self.assertFalse(gate.run(s,s.entry('example'),'apply',r)['ok'])
    def test_critical_review_cannot_advance(self):
        s=self.p.apply_started(); self.p.write('openspec/changes/example/tasks.md','## Implementation\n- [x] T1 Implement example\n')
        r=self.p.report(s,findings=[{'severity':'critical','description':'broken behavior'}]); self.assertFalse(gate.run(s,s.entry('example'),'apply',r)['ok'])
    def test_review_evidence_mutation_invalidates_pass(self):
        s=self.p.archive_ready(); self.p.write('manager/runtime/evidence/check.txt','modified')
        with self.assertRaisesRegex(Invalid,'evidence'): archive.prepare(s,s.entry('example'),'test')
    def test_log_mutation_invalidates_pass(self):
        s=self.p.archive_ready(); log=s.state['gates']['example']['apply']['checks'][0]['log']; self.p.write(log,'modified')
        with self.assertRaisesRegex(Invalid,'log'): archive.prepare(s,s.entry('example'),'test')
    def test_unchecked_tasks_block_gate(self):
        s=self.p.apply_started()
        with self.assertRaisesRegex(Invalid,'completed|unchecked'): gate.run(s,s.entry('example'),'apply',self.p.report(s))
    def test_ui_actual_diff_requires_baseline(self):
        s=self.p.apply_started(); self.p.write('src/Page.tsx','<main>Example</main>'); self.p.write('openspec/changes/example/tasks.md','## Implementation\n- [x] T1 Implement example\n')
        self.assertFalse(gate.run(s,s.entry('example'),'apply',self.p.report(s))['ok'])
    def test_ui_approval_and_actual_artifacts(self):
        self.p.write('docs/design/baseline.md','Approved layout'); self.p.plan['openspec'][0]['ui_baseline']='docs/design/baseline.md'; self.p.plan['openspec'][0]['impacts']=['ui']; self.p.save()
        s=self.p.apply_started(); flow.approve(s,'docs/design/baseline.md',['docs/prd/example.md'],'test UI approval')
        self.p.write('openspec/changes/example/tasks.md','## Implementation\n- [x] T1 Implement example\n')
        self.p.write('manager/runtime/evidence/screen.png','fixture bytes, not actual visual acceptance')
        self.p.write('manager/runtime/evidence/browser.txt','fixture interaction transcript')
        ui={'decision_ref':'test acceptance','screenshots':['manager/runtime/evidence/screen.png'],'interaction_evidence':'manager/runtime/evidence/browser.txt'}
        self.assertTrue(gate.run(s,s.entry('example'),'apply',self.p.report(s,ui=ui))['ok'])
    def test_single_change_can_offer_two_parallel_tasks(self):
        self.p.graph([task('A'),task('B',writes=['src/b'])]); s=self.p.apply_started()
        self.assertEqual([t['id'] for t in tasks.ready(s,s.entry('example'))['ready']],['A','B'])
    def test_read_write_conflict_serializes(self):
        self.p.graph([task('A'),task('B',writes=['src/b'],reads=['src/a'])]); s=self.p.apply_started()
        self.assertEqual(len(tasks.ready(s,s.entry('example'))['ready']),1)
    def test_shared_test_resource_serializes(self):
        self.p.graph([task('A',resources=['db']),task('B',writes=['src/b'],resources=['db'])]); s=self.p.apply_started()
        self.assertEqual(len(tasks.ready(s,s.entry('example'))['ready']),1)
    def test_persistent_claim_and_manual_release(self):
        self.p.graph([task()]); s=self.p.apply_started(); r=tasks.claim(s,s.entry('example'),'T1','native-id-test')
        s=self.p.store(); self.assertFalse(tasks.ready(s,s.entry('example'))['ready'])
        with self.assertRaises(Invalid): tasks.release(s,r['run_id'],False,'test')
        tasks.release(s,r['run_id'],True,'test confirmed original stopped'); self.assertTrue(tasks.ready(s,s.entry('example'))['ready'])
    def test_claim_rejects_unknown_role(self):
        self.p.graph([task(role='missing')]); s=self.p.apply_started()
        with self.assertRaisesRegex(Invalid,'not ready'): tasks.claim(s,s.entry('example'),'T1','id')
    def test_task_completion_marks_only_assigned_checkbox(self):
        self.p.graph([task('A'),task('B',writes=['src/b'])]); s=self.p.apply_started(); r=tasks.claim(s,s.entry('example'),'A','a-test')
        self.p.write('src/a/result.py','value=1'); self.p.write('manager/runtime/evidence/task.txt','check fixture')
        result={'run_id':r['run_id'],'agent_id':'a-test','contract':r['contract'],'status':'completed','changed_files':['src/a/result.py'],'checks':[{'status':'passed','evidence':'manager/runtime/evidence/task.txt'}]}
        self.p.write('manager/runtime/evidence/task.json',json.dumps(result)); tasks.finish(s,r['run_id'],'manager/runtime/evidence/task.json')
        text=(self.p.root/'openspec/changes/example/tasks.md').read_text(); self.assertIn('[x] A',text); self.assertIn('[ ] B',text)
    def test_task_cannot_write_unassigned_spec(self):
        self.p.graph([task()]); s=self.p.apply_started(); r=tasks.claim(s,s.entry('example'),'T1','id')
        self.p.write('openspec/changes/example/design.md','unauthorized new design')
        self.p.write('manager/runtime/evidence/task.json',json.dumps({'run_id':r['run_id'],'agent_id':'id','contract':r['contract'],'status':'completed'}))
        with self.assertRaisesRegex(Invalid,'stale'): tasks.finish(s,r['run_id'],'manager/runtime/evidence/task.json')
    def test_task_graph_rejects_cycle_and_traversal(self):
        for definitions in ([task('A',needs=['B']),task('B',needs=['A'])],[task(writes=['../outside'])],[task(writes=['manager'])]):
            self.p.graph(definitions); s=self.p.store()
            with self.assertRaises(Invalid): tasks.execution(s,s.entry('example'))
    def test_repair_is_bounded_and_code_only(self):
        s=self.p.apply_started()
        with self.assertRaises(Invalid): flow.repair_begin(s,s.entry('example'),'F1',['docs'])
        for index in range(2):
            rec=flow.repair_begin(s,s.entry('example'),f'different-name-{index}',['src'])
            self.p.write('src/api.py',f'value={index+10}'); self.assertTrue(flow.repair_finish(s,rec['key'])['ok'])
        with self.assertRaisesRegex(Invalid,'budget'): flow.repair_begin(self.p.store(),self.p.store().entry('example'),'new-name',['src'])
    def test_repair_detects_unapproved_spec_edit(self):
        s=self.p.apply_started(); r=flow.repair_begin(s,s.entry('example'),'F1',['src'])
        self.p.write('docs/prd/example.md','erase promise'); result=flow.repair_finish(s,r['key'])
        self.assertFalse(result['ok']); self.assertEqual(self.p.store().entry('example')['state'],'blocked')
    def test_reopen_invalidates_downstream_not_unrelated(self):
        self.p.add('child',['example']); self.p.add('other'); s=self.p.store(); result=flow.reopen(s,['example'],'requirement','test new requirement')
        self.assertEqual(result['affected'],['child','example']); self.assertEqual(s.entry('other').get('revision',1),1); self.assertEqual(s.entry('child')['revision'],2)
    def test_cancelled_dependency_is_never_complete(self):
        self.p.add('child',['example']); s=self.p.store(); flow.cancel(s,['example'],'test cancel')
        self.assertTrue(flow.deps(s,s.entry('child'),'change'))
    def test_archive_requires_real_operator_step_and_is_idempotent(self):
        s,rec=self.p.archived(); self.assertTrue(s.proof('example'))
        result=archive.finalize(s,rec['ticket'],'openspec/changes/archive/2026-09-22-example'); self.assertTrue(result['idempotent'])
    def test_archive_ready_cannot_advance_directly(self):
        s=self.p.archive_ready()
        with self.assertRaisesRegex(Invalid,'archive-finalize'): flow.advance(s,s.entry('example'),'archive')
    def test_archive_rejects_old_history_edits(self):
        self.p.write('openspec/changes/archive/2020-01-01-old/spec.md','old'); s=self.p.store(); archive.seal(s,'test baseline audit')
        self.p.write('openspec/changes/archive/2020-01-01-old/spec.md','new')
        with self.assertRaisesRegex(Invalid,'history'): s.guard_history()
        with self.assertRaisesRegex(Invalid,'hide'): archive.seal(s,'try reseal')
    def test_archive_rejects_new_file_inside_old_unit(self):
        self.p.write('openspec/changes/archive/2020-01-01-old/spec.md','old'); s=self.p.store(); archive.seal(s,'test baseline audit')
        self.p.write('openspec/changes/archive/2020-01-01-old/build/new.txt','new')
        with self.assertRaises(Invalid): s.guard_history()
    def test_archive_finalize_checks_exact_new_content(self):
        s=self.p.archive_ready(); rec=archive.prepare(s,s.entry('example'),'test'); subprocess.run(rec['operator_command'],cwd=self.p.root,check=True,capture_output=True)
        self.p.write('openspec/changes/archive/2026-09-22-example/extra.md','extra')
        with self.assertRaisesRegex(Invalid,'differs'): archive.finalize(s,rec['ticket'],'openspec/changes/archive/2026-09-22-example')
    def test_prune_preserves_verified_dependencies(self):
        self.p.add('child',['example'],batch='m2'); s,_=self.p.archived(); archive.prune(s,['example'],'test prune')
        s=self.p.store(); self.assertTrue(s.proof('example')); self.assertEqual(flow.deps(s,s.entry('child'),'change'),[])
    def test_pruned_proof_cannot_be_deleted(self):
        self.p.add('child',['example'],batch='m2'); s,_=self.p.archived(); archive.prune(s,['example'],'test prune')
        (self.p.root/'manager/archive/completed/example.json').unlink()
        with self.assertRaisesRegex(Invalid,'unknown dependency'): self.p.store()
    def test_archived_change_cannot_reopen(self):
        s,_=self.p.archived()
        with self.assertRaisesRegex(Invalid,'terminal'): flow.reopen(s,['example'],'design','test')
    def test_goal_no_progress_stops(self):
        s=self.p.approved(); rec=flow.session_open(s,['m1'],3,'test limited authorization'); flow.round_begin(s,rec['session'])
        result=flow.round_finish(s,rec['session']); self.assertEqual(result['footer'],'MANAGER-RUN: STOP(no-progress)')
    def test_goal_does_not_restart_open_round(self):
        s=self.p.approved(); rec=flow.session_open(s,['m1'],3,'test'); flow.round_begin(s,rec['session'])
        with self.assertRaisesRegex(Invalid,'unfinished'): flow.round_begin(self.p.store(),rec['session'])
    def test_goal_does_not_treat_restart_as_approval(self):
        s=self.p.store(); rec=flow.session_open(s,['m1'],3,'test'); result=flow.round_begin(s,rec['session'])
        self.assertEqual(result['footer'],'MANAGER-RUN: STOP(held)'); self.assertFalse(s.state['approvals'])
    def test_scope_change_stops_goal(self):
        s=self.p.approved(); rec=flow.session_open(s,['m1'],3,'test'); self.p.plan['batches'][0]['goal']='new goal'; self.p.save()
        with self.assertRaisesRegex(Invalid,'scope changed'): flow.round_begin(self.p.store(),rec['session'])
    def test_runtime_integrity_error_is_not_silent_reset(self):
        self.p.approved(); self.p.write('manager/runtime/state.json','{}')
        with self.assertRaisesRegex(Invalid,'integrity'): self.p.store()
    def test_journal_recovers_partial_write(self):
        s=self.p.store(); path='manager/runtime/evidence/recovered.txt'; self.p.write(path,'old')
        journal={'writes':[{'path':path,'before':digest(b'old'),'hex':b'new'.hex()}]}; atomic(s.journal,encoded(journal)); s.recover()
        self.assertEqual((self.p.root/path).read_text(),'new'); self.assertFalse(s.journal.exists())
    def test_journal_conflict_does_not_overwrite_user_edit(self):
        s=self.p.store(); path='src/api.py'; atomic(s.journal,encoded({'writes':[{'path':path,'before':digest(b'old'),'hex':b'new'.hex()}]}))
        before=(self.p.root/path).read_bytes()
        with self.assertRaisesRegex(Invalid,'transaction conflict'): s.recover()
        self.assertEqual((self.p.root/path).read_bytes(),before)
    def test_duplicate_yaml_keys_and_invalid_enums_rejected(self):
        with self.assertRaises(Invalid): parse('version: 2\nversion: 1\n')
        for field,value in [('phase','implemented'),('state','done'),('path','openspec/changes/archive/2026-example')]:
            p=deepcopy(self.p.plan); p['openspec'][0][field]=value; self.assertTrue(validate(p)[0])
    def test_symlink_escape_rejected(self):
        target=self.p.root/'docs/prd/alias.md'; target.symlink_to('/etc/passwd')
        with self.assertRaisesRegex(Invalid,'symlink'): self.p.store().source({'source':'docs/prd/alias.md'})
    def test_cli_end_to_end_missing_approval_is_nonzero(self):
        before=self.p.plan_path.read_bytes(); result=self.p.cli('start','--change','example')
        self.assertNotEqual(result.returncode,0); self.assertNotIn('Traceback',result.stderr); self.assertEqual(self.p.plan_path.read_bytes(),before)
    def test_cli_doctor_not_a_stub(self):
        result=self.p.cli('doctor'); self.assertEqual(result.returncode,0,result.stderr); self.assertEqual(json.loads(result.stdout)['native_execution'],'unverified')
        (self.p.root/'manager/policy.yaml').unlink(); self.assertNotEqual(self.p.cli('doctor').returncode,0)

class AdditionalRuntimeTests(unittest.TestCase):
    setUp=RuntimeTests.setUp
    tearDown=RuntimeTests.tearDown
    def test_gate_can_run_project_validator_without_recursive_lock_failure(self):
        policy=yaml.safe_load((self.p.root/'manager/policy.yaml').read_text())
        policy['checks']['apply']=[[sys.executable,str(SCRIPTS/'plan_tool.py'),'--plan','manager/plan.yaml','validate']]
        self.p.write('manager/policy.yaml',yaml.safe_dump(policy))
        self.p.apply_started(); p=self.p.root/'openspec/changes/example/tasks.md'; p.write_text(p.read_text().replace('[ ]','[x]'))
        s=self.p.store(); report=self.p.report(s)
        result=self.p.cli('gate-run','--change','example','--stage','apply','--review-file',report)
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
    def test_two_processes_cannot_claim_same_task(self):
        self.p.graph([task()]); self.p.apply_started()
        argv=[sys.executable,str(SCRIPTS/'plan_tool.py'),'--plan',str(self.p.plan_path),'task-claim','--change','example','--task','T1','--agent-id']
        a=subprocess.Popen(argv+['native-a'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        b=subprocess.Popen(argv+['native-b'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        a.communicate(timeout=15); b.communicate(timeout=15)
        self.assertEqual(sorted([a.returncode,b.returncode]),[0,1])
        self.assertEqual(len(self.p.store().running()),1)
    def test_required_scope_missing_or_unsupported_blocks_source(self):
        s=self.p.store()
        self.assertIn('files',s.source({'source':'docs/prd/example.md','scope':['heading:Requirement R1']}))
        for scope in ('heading:Missing','node-id:123','legacy token'):
            with self.assertRaises(Invalid): s.source({'source':'docs/prd/example.md','scope':[scope]})
        self.assertIn('skipped',s.source({'source':'docs/prd/example.md','required':False,'scope':['node-id:123']}))
    def test_source_operation_and_json_pointer_scope(self):
        self.p.write('docs/api.yaml','paths:\n  /example:\n    get:\n      operationId: getExample\n')
        s=self.p.store()
        for scope in ('operation-id:getExample','json-pointer:/paths/~1example/get'):
            self.assertIn('files',s.source({'source':'docs/api.yaml','scope':[scope]}))
    def test_worker_cannot_tick_own_task(self):
        self.p.graph([task()]); s=self.p.apply_started(); r=tasks.claim(s,s.entry('example'),'T1','id')
        p=self.p.root/'openspec/changes/example/tasks.md'; p.write_text(p.read_text().replace('[ ]','[x]'))
        self.p.write('manager/runtime/evidence/r.json',json.dumps({'run_id':r['run_id'],'agent_id':'id','contract':r['contract'],'status':'completed'}))
        with self.assertRaisesRegex(Invalid,'only Manager'): tasks.finish(s,r['run_id'],'manager/runtime/evidence/r.json')
    def test_downstream_changes_code_and_still_completes_with_integrated_gate(self):
        self.p.add('child',['example'],batch='m2'); self.p.archive_ready()
        s=self.p.apply_started('child'); self.p.write('src/child.py','value=2\n')
        p=self.p.root/'openspec/changes/child/tasks.md'; p.write_text(p.read_text().replace('[ ]','[x]'))
        result=gate.run(s,s.entry('child'),'apply',self.p.report(s,'child')); self.assertTrue(result['ok'],result)
        flow.advance(s,s.entry('child'),'apply'); self.assertEqual(s.entry('child')['phase'],'archive')
        with self.assertRaisesRegex(Invalid,'stale'): archive.prepare(s,s.entry('example'),'test')
        # Refresh the prior completion's full integration gate, not its implementation.
        result=gate.run(s,s.entry('example'),'apply',self.p.report(s)); self.assertTrue(result['ok'],result)
        self.assertIn('ticket',archive.prepare(s,s.entry('example'),'test'))
    def test_change_authoring_resumes_after_expected_artifact_edits(self):
        s=self.p.approved(); flow.start(s,s.entry('example'),'id')
        self.p.write('openspec/changes/example/design.md','## Context\nAn updated implementation design.\n')
        s=self.p.store(); self.assertTrue(flow.start(s,s.entry('example'),'id')['resumed'])
    def test_legacy_completion_import_requires_audited_seal(self):
        p=self.p.root/'openspec/changes/example'
        dest='openspec/changes/archive/2020-01-01-example'; (self.p.root/dest).parent.mkdir(parents=True)
        shutil.move(p,self.p.root/dest); self.p.plan['openspec'][0]['phase']='done'; self.p.plan['openspec'][0].pop('state'); self.p.save()
        s=self.p.store()
        with self.assertRaises(Invalid): archive.import_completion(s,'example',dest,'test audit')
        archive.seal(s,'test audited history')
        result=archive.import_completion(s,'example',dest,'test audited legacy completion'); self.assertEqual(result['prior_gate'],'unavailable'); self.assertTrue(s.proof('example'))
    def test_milestone_stays_valid_after_its_explicit_archive(self):
        s=self.p.archive_ready(); flow.approve_milestone(s,'m1','test product acceptance')
        rec=archive.prepare(s,s.entry('example'),'test archive')
        subprocess.run(rec['operator_command'],cwd=self.p.root,check=True,capture_output=True)
        archive.finalize(s,rec['ticket'],'openspec/changes/archive/2026-09-22-example')
        session=flow.session_open(s,['m1'],2,'test scope')
        self.assertEqual(flow.round_begin(s,session['session'])['footer'],'MANAGER-RUN: STOP(no-work)')

@unittest.skipUnless(os.environ.get('MANAGER_LIVE_OPENSPEC')=='1','real OpenSpec CLI integration is enabled in CI')
class LiveOpenSpecTests(unittest.TestCase):
    def test_real_cli_validate_apply_gate_archive_and_prune(self):
        self.assertIsNotNone(shutil.which('openspec'),'CI must install real OpenSpec, not skip this test')
        with tempfile.TemporaryDirectory() as td:
            p=Project(td,live=True)
            s,rec=p.archived(); self.assertTrue(s.proof('example'))
            archive.prune(s,['example'],'test prune'); self.assertEqual(p.store().plan['openspec'],[])

if __name__=='__main__': unittest.main()
