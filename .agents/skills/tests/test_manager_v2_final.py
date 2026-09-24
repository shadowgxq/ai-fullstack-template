"""V2 final regression scenarios. Fixtures are explicitly not native model evidence."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import yaml

from test_manager_runtime import Project, task, SCRIPTS
from manager_schema import Invalid, select_next
from manager_store import Store
from manager_roles import check_roles, describe_role, role_definition
import manager_flow as flow
import manager_gate as gate
import manager_tasks as tasks

ROOT = SCRIPTS.parents[1]
spec = importlib.util.spec_from_file_location('init_manager_project', ROOT/'scripts/init_manager_project.py')
initializer = importlib.util.module_from_spec(spec); spec.loader.exec_module(initializer)


class RoleConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.p=Project(self.tmp.name)
    def tearDown(self):
        self.p.close(); self.tmp.cleanup()
    def config(self, text):
        self.p.write('.codex/config.toml', text)
    def test_complete_template_initializes_then_doctor_passes(self):
        with tempfile.TemporaryDirectory() as td:
            result=initializer.initialize(td,True)
            self.assertIn('manager/roles.yaml',result['created'])
            store=Store(Path(td)/'manager/plan.yaml'); store.load(allow_empty=True)
            self.assertTrue(flow.doctor(store)['ok'])
            self.assertEqual(len(check_roles(store)),9)
            self.assertEqual(describe_role(store,'backend-dev')['configured_model'],'gpt-6-sol')
            self.assertEqual(describe_role(store,'explorer')['configured_model'],'gpt-6-luna')
    def test_missing_roles_and_empty_routes_are_errors(self):
        (self.p.root/'manager/roles.yaml').unlink()
        self.assertFalse(flow.doctor(self.p.store())['ok'])
        self.p.write('manager/roles.yaml','routes: {}\n')
        self.assertFalse(flow.doctor(self.p.store())['ok'])
    def test_start_cannot_skip_missing_routes(self):
        store=self.p.approved(); (self.p.root/'manager/roles.yaml').unlink()
        with self.assertRaisesRegex(Invalid,'missing manager/roles'):
            flow.start(store,store.entry('example'))
    def test_task_only_role_is_checked_by_doctor(self):
        self.p.graph([task(role='missing-role')])
        result=flow.doctor(self.p.store())
        self.assertFalse(result['ok']); self.assertIn('missing-role',' '.join(result['errors']))
    def test_standalone_roles_need_no_registry(self):
        self.assertEqual(role_definition(self.p.store(),'backend-dev')['name'],'backend-dev')
    def test_broken_explicit_registry_is_not_silently_ignored(self):
        self.config('[agents.backend-dev]\nconfig_file = "agents/missing.toml"\n')
        with self.assertRaisesRegex(Invalid,'missing native role'):
            role_definition(self.p.store(),'backend-dev')
    def test_registry_path_cannot_escape(self):
        self.config('[agents.backend-dev]\nconfig_file = "../../other.toml"\n')
        with self.assertRaisesRegex(Invalid,'inside project'):
            role_definition(self.p.store(),'backend-dev')
    def test_legacy_explicit_registration_supported(self):
        self.config('[agents.backend-dev]\nconfig_file = "agents/backend-dev.toml"\n')
        self.assertEqual(role_definition(self.p.store(),'backend-dev')['name'],'backend-dev')
    def test_invalid_native_config_has_structured_cli_error(self):
        self.config('model = [\n')
        result=self.p.cli('resolve-role','--role','backend-dev')
        self.assertNotEqual(result.returncode,0); self.assertNotIn('Traceback',result.stderr)
    def test_disabled_subagents_and_capacity_mismatch_visible(self):
        self.config('[agents]\nenabled = false\n')
        self.assertFalse(flow.doctor(self.p.store())['ok'])
        self.config('[agents]\nmax_concurrent_threads_per_session = 1\n')
        self.assertIn('capacity',' '.join(flow.doctor(self.p.store())['errors']))
    def test_inherited_model_is_configured_not_observed(self):
        self.config('model = "parent"\nmodel_reasoning_effort = "high"\n[agents]\ndefault_subagent_model = "primary"\ndefault_subagent_reasoning_effort = "xhigh"\n')
        path=self.p.root/'.codex/agents/backend-dev.toml'
        path.write_text(path.read_text().replace('model = "fixture-model-not-a-real-invocation"\n',''))
        store=self.p.store(); result=describe_role(store,'backend-dev')
        self.assertEqual((result['configured_model'],result['configured_reasoning_effort']),('primary','xhigh'))
        self.assertIsNone(result['observed_model']); self.assertEqual(result['native_execution'],'unverified')
        self.p.graph([task()]); store=self.p.apply_started()
        claim=tasks.claim(store,store.entry('example'),'T1','test-native-id')
        saved=store.state['claims'][claim['run_id']]
        self.assertEqual(saved['requested_model'],'primary'); self.assertIsNone(saved['observed_model'])
    def test_role_override_wins_and_missing_default_remains_unknown(self):
        self.config('model = "primary"\n[agents]\ndefault_subagent_model = "primary"\ndefault_subagent_reasoning_effort = "xhigh"\n')
        result=describe_role(self.p.store(),'backend-dev')
        self.assertEqual(result['configured_model'],'fixture-model-not-a-real-invocation')
        path=self.p.root/'.codex/agents/backend-dev.toml'
        path.write_text(path.read_text().replace('model = "fixture-model-not-a-real-invocation"\n',''))
        (self.p.root/'.codex/config.toml').unlink()
        self.assertIsNone(describe_role(self.p.store(),'backend-dev')['configured_model'])
    def test_unknown_model_default_effort_not_invented(self):
        self.config('model_reasoning_effort = "high"\n[agents]\ndefault_subagent_model = "a-new-model"\n')
        self.assertIsNone(describe_role(self.p.store(),'backend-dev')['configured_reasoning_effort'])
    def test_permission_profile_must_exist_and_cannot_mix_modes(self):
        path=self.p.root/'.codex/agents/backend-dev.toml'; path.write_text(path.read_text()+'\ndefault_permissions = "missing"\n')
        self.config('[agents]\n')
        self.assertFalse(flow.doctor(self.p.store())['ok'])
        self.config('sandbox_mode = "read-only"\n[permissions.missing]\nextends = ":workspace"\n')
        self.assertIn('mix',' '.join(flow.doctor(self.p.store())['errors']))
    def test_builtin_permission_is_valid(self):
        self.config('default_permissions = ":read-only"\n')
        self.assertTrue(flow.doctor(self.p.store())['ok'])
    def test_legacy_role_lists_and_explicit_fallback_are_supported(self):
        self.p.write('manager/roles.yaml',yaml.safe_dump({'routes':{'change':{'agent_type':'architect'},'apply':[{'agent_type':'backend-dev','fallback':'frontend-dev'}],'verify':{'agent_type':'reviewer'}}}))
        self.assertTrue(flow.doctor(self.p.store())['ok'])
    def test_permission_profile_cycle_fails(self):
        self.config('default_permissions = "a"\n[permissions.a]\nextends = "b"\n[permissions.b]\nextends = "a"\n')
        self.assertIn('cyclic',' '.join(flow.doctor(self.p.store())['errors']))
    def test_resolve_role_is_read_only_before_plan_exists(self):
        before=self.p.store().workspace()
        result=self.p.cli('resolve-role','--role','backend-dev')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(before,self.p.store().workspace())
        self.assertFalse((self.p.root/'manager/runtime/state.json').exists())


class InitializationTests(unittest.TestCase):
    def test_preview_is_read_only_and_write_idempotent(self):
        with tempfile.TemporaryDirectory() as td:
            result=initializer.initialize(td)
            self.assertIn('manager/roles.yaml',result['would_create']); self.assertEqual(list(Path(td).iterdir()),[])
            initializer.initialize(td,True)
            result=initializer.initialize(td,True)
            self.assertEqual(result['created'],[]); self.assertFalse((Path(td)/'manager/plan.yaml').exists())
            self.assertFalse((Path(td)/'manager/runtime').exists())
    def test_existing_config_checks_and_role_customization_preserved(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); (root/'.codex/agents').mkdir(parents=True); (root/'manager').mkdir()
            files={'.codex/config.toml':'model = "my-model"\n','.codex/agents/qa.toml':'# my customized role\n','manager/policy.yaml':'# real project checks\n','manager/plan.yaml':'# existing plan\n'}
            for name,text in files.items(): (root/name).write_text(text)
            result=initializer.initialize(td,True)
            for name,text in files.items(): self.assertEqual((root/name).read_text(),text)
            self.assertIn('.codex/config.toml',result['preserved'])
    def test_symlink_preflight_does_not_copy_anything(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as other:
            (Path(td)/'.codex').symlink_to(other,target_is_directory=True)
            with self.assertRaisesRegex(Invalid,'symlink'): initializer.initialize(td,True)
            self.assertFalse((Path(td)/'manager').exists()); self.assertEqual(list(Path(other).iterdir()),[])
    def test_active_session_blocks_initialization(self):
        with tempfile.TemporaryDirectory() as td:
            project=Project(td)
            try:
                store=project.approved(); flow.session_open(store,['m1'],4,'test-only scope')
                with self.assertRaisesRegex(Invalid,'stop active'): initializer.initialize(td,True)
            finally: project.close()


class LifecycleAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.p=Project(self.tmp.name)
    def tearDown(self): self.p.close(); self.tmp.cleanup()
    def test_semantic_requirement_edit_invalidates_session(self):
        store=self.p.approved(); sid=flow.session_open(store,['m1'],8,'test scope')['session']
        store.plan['requirements'][0]['acceptance']=['changed behavior']; store.commit()
        with self.assertRaisesRegex(Invalid,'scope changed'): flow.round_begin(self.p.store(),sid)
    def test_semantic_change_risk_edit_invalidates_session(self):
        store=self.p.approved(); sid=flow.session_open(store,['m1'],8,'test scope')['session']
        store.entry('example')['risk']='high'; store.commit()
        with self.assertRaisesRegex(Invalid,'scope changed'): flow.round_begin(self.p.store(),sid)
    def test_input_definition_edit_invalidates_session(self):
        self.p.plan['inputs']=[{'id':'future','kind':'dataset','source':'docs/future.csv','required':True}]
        self.p.plan['openspec'][0]['input_refs']=['future']; self.p.save()
        store=self.p.approved(); sid=flow.session_open(store,['m1'],8,'test scope')['session']
        store.plan['inputs'][0]['source']='docs/different.csv'; store.commit()
        with self.assertRaisesRegex(Invalid,'scope changed'): flow.round_begin(self.p.store(),sid)
    def test_failed_task_blocks_reclaim(self):
        self.p.graph([task()]); store=self.p.apply_started()
        claim=tasks.claim(store,store.entry('example'),'T1','test-id')
        self.p.write('manager/runtime/evidence/failed.json',json.dumps({'run_id':claim['run_id'],'agent_id':'test-id','contract':claim['contract'],'status':'failed','changed_files':[]}))
        result=tasks.finish(store,claim['run_id'],'manager/runtime/evidence/failed.json')
        self.assertFalse(result['ok']); self.assertEqual(store.entry('example')['state'],'blocked')
        with self.assertRaisesRegex(Invalid,'blocked'): flow.start(self.p.store(),self.p.store().entry('example'))
    def test_code_reopen_invalidates_old_claim_completion(self):
        self.p.graph([task()]); store=self.p.apply_started()
        claim=tasks.claim(store,store.entry('example'),'T1','test-id')
        self.p.write('src/a','value=1\n'); self.p.write('manager/runtime/evidence/task.txt','test fixture\n')
        self.p.write('manager/runtime/evidence/task.json',json.dumps({'run_id':claim['run_id'],'agent_id':'test-id','contract':claim['contract'],'status':'completed','changed_files':['src/a'],'checks':[{'status':'passed','evidence':'manager/runtime/evidence/task.txt'}]}))
        tasks.finish(store,claim['run_id'],'manager/runtime/evidence/task.json')
        flow.reopen(store,['example'],'code','test code correction')
        self.assertEqual(store.state['claims'][claim['run_id']]['status'],'superseded')
        with self.assertRaisesRegex(Invalid,'not completed'): tasks.complete(store,store.entry('example'))
        self.assertIn('[ ] T1',(self.p.root/'openspec/changes/example/tasks.md').read_text())
        flow.start(store,store.entry('example'),'test-id-new')
        second=tasks.claim(store,store.entry('example'),'T1','test-id-new')
        self.p.write('src/a','value=2\n')
        self.p.write('manager/runtime/evidence/task2.json',json.dumps({'run_id':second['run_id'],'agent_id':'test-id-new','contract':second['contract'],'status':'completed','changed_files':['src/a'],'checks':[{'status':'passed','evidence':'manager/runtime/evidence/task.txt'}]}))
        self.assertEqual(tasks.finish(store,second['run_id'],'manager/runtime/evidence/task2.json')['status'],'completed')
    def test_native_writer_without_execution_is_not_silent_no_work(self):
        store=self.p.apply_started(); result=tasks.ready(store,store.entry('example'))
        self.assertEqual(result['ready'],[]); self.assertIn('execution.yaml',result['held'][0]['reasons'][0])
    def test_same_wave_producer_can_apply_before_consumer_input_exists(self):
        self.p.add('child',['example'])
        self.p.plan['openspec'][1]['inputs']=[{'id':'generated','kind':'dataset','source':'docs/generated.csv','required':True}]; self.p.save()
        self.p.change_done()
        result=flow.next_work(self.p.store())
        self.assertIsNotNone(result['selected'],result)
        self.assertEqual((result['selected']['stage'],result['selected']['entries'][0]['id']),('apply','example'))
    def test_apply_only_can_select_ready_apply_in_mixed_wave(self):
        self.p.add('child',['example']); self.p.change_done()
        result=select_next(self.p.store().plan,'apply-only')
        self.assertEqual(result['selected']['entries'][0]['id'],'example')
    def test_empty_review_evidence_is_not_pass(self):
        store=self.p.apply_started(); path=self.p.root/'openspec/changes/example/tasks.md'; path.write_text(path.read_text().replace('[ ]','[x]'))
        report=self.p.report(store)
        self.p.write('manager/runtime/evidence/check.txt','')
        result=gate.run(store,store.entry('example'),'apply',report)
        self.assertFalse(result['ok']); self.assertIn('nonempty',result['receipt']['error'])
    def test_secret_contents_are_never_opened_for_snapshot(self):
        self.p.write('.env','SECRET=test-only-not-a-real-secret\n'); store=self.p.store()
        original=Path.read_bytes
        def read(path):
            if path.name=='.env': raise AssertionError('opened denied secret content')
            return original(path)
        with patch.object(Path,'read_bytes',read):
            before=store.workspace(); self.assertIn('.env',before)
            self.p.write('.env','CHANGED=test-only\n'); after=store.workspace()
            self.assertNotEqual(before['.env'],after['.env'])

    def test_omitting_manual_prerequisite_does_not_skip_acceptance(self):
        self.p.add('child',['example'],batch='m2'); store=self.p.archive_ready()
        sid=flow.session_open(store,['m2'],4,'test m2 only')['session']
        self.assertEqual(flow.round_begin(store,sid)['footer'],'MANAGER-RUN: STOP(milestone)')
        flow.approve_milestone(store,'m1','test actual prerequisite acceptance')
        sid=flow.session_open(store,['m2'],4,'test resume m2')['session']
        self.assertEqual(flow.round_begin(store,sid)['selection']['batch'],'m2')
    def test_omitting_auto_prerequisite_allows_verified_continuation(self):
        self.p.add('child',['example'],batch='m2'); self.p.plan['batches'][0]['checkpoint']='auto'; self.p.save()
        store=self.p.archive_ready(); sid=flow.session_open(store,['m2'],4,'test m2 only')['session']
        self.assertEqual(flow.round_begin(store,sid)['selection']['batch'],'m2')
        self.assertFalse(store.state['milestones'])
    def test_prerequisite_checkpoint_edit_invalidates_new_session(self):
        self.p.add('child',['example'],batch='m2'); store=self.p.archive_ready()
        sid=flow.session_open(store,['m2'],4,'test m2 only')['session']
        store.plan['batches'][0]['checkpoint']='auto'; store.commit()
        with self.assertRaisesRegex(Invalid,'scope changed'): flow.round_begin(store,sid)
    def test_unrelated_unaccepted_batch_does_not_block_selected_work(self):
        self.p.add('independent',batch='m2'); store=self.p.approved()
        sid=flow.session_open(store,['m2'],4,'test unrelated scope')['session']
        self.assertEqual(flow.round_begin(store,sid)['selection']['batch'],'m2')
    def test_unknown_batch_is_not_no_work(self):
        with self.assertRaisesRegex(Invalid,'unknown batch'):
            select_next(self.p.plan,'auto','typo')
    def test_fallback_never_skips_current_wave(self):
        self.p.add('later',batch='m2')
        self.p.plan['openspec'][0]['state']='blocked'; self.p.save()
        self.assertIsNone(flow.next_work(self.p.store())['selected'])


# Keep live CLI integration separate from the deterministic control fixtures above.
@unittest.skipUnless(__import__('os').environ.get('MANAGER_LIVE_OPENSPEC')=='1', 'real OpenSpec CLI integration is enabled in CI')
class LiveFinalWorkflowTests(unittest.TestCase):
    def test_real_cli_initialized_two_batch_claim_gate_accept_archive(self):
        import manager_archive as archive
        with tempfile.TemporaryDirectory() as td:
            p=Project(td,live=True)
            p.add('child',['example'],batch='m2')
            initializer.initialize(td,True)
            # Explicit test configuration: no real user approvals or native agents.
            p.write('manager/roles.yaml',(ROOT/'templates/project/manager/roles.yaml').read_text())
            for role in (ROOT/'templates/project/.codex/agents').glob('*.toml'):
                p.write('.codex/agents/'+role.name,role.read_text())
            p.write('tests/test_behavior.py', 'import runpy, unittest\nclass Behavior(unittest.TestCase):\n def test_example(self): self.assertEqual(runpy.run_path("src/api.py")["example"](),1)\n')
            policy=yaml.safe_load((p.root/'manager/policy.yaml').read_text())
            policy['checks']['apply']=[[sys.executable,'-m','unittest','discover','-s','tests','-v']]
            p.write('manager/policy.yaml',yaml.safe_dump(policy))
            for batch in p.plan['batches']: batch['checkpoint']='auto'
            p.plan['batches'][1]['checkpoint']='manual'; p.save()
            # Different capabilities prevent an unrelated duplicate ADDED requirement on archive.
            specdir=p.root/'openspec/changes/child/specs/example'
            specdir.rename(specdir.with_name('child'))
            proposal=p.root/'openspec/changes/child/proposal.md'
            proposal.write_text(proposal.read_text().replace('`example`','`child`'))
            for cid in ('example','child'):
                path='src/api.py' if cid=='example' else 'src/child.py'
                p.write(f'openspec/changes/{cid}/execution.yaml',yaml.safe_dump({'tasks':[task(writes=[path,'tests/test_behavior.py'])]}))
            store=p.approved(); self.assertTrue(flow.doctor(store)['ok'])
            sid=flow.session_open(store,['m1','m2'],8,'TEST ONLY: bounded execution')['session']
            for index in range(4):
                store=p.store(); selection=flow.round_begin(store,sid)['selection']
                cid=selection['entries'][0]['id']; entry=store.entry(cid); stage=selection['stage']
                flow.start(store,entry,'fixture-implementer')
                if stage=='change':
                    self.assertTrue(gate.run(store,entry,'change')['ok'])
                    flow.advance(store,entry,'change'); flow.set_review(store,entry,'approved','TEST ONLY: artifact approval')
                else:
                    claim=tasks.claim(store,entry,'T1','fixture-worker-'+cid)
                    path='src/api.py' if cid=='example' else 'src/child.py'
                    p.write(path,'def example(): return 1\n# implemented fixture\n' if cid=='example' else 'def child(): return 2\n')
                    changed=[path]
                    if cid=='child':
                        test=p.root/'tests/test_behavior.py'; test.write_text(test.read_text()+' def test_child(self): self.assertEqual(runpy.run_path("src/child.py")["child"](),2)\n')
                        changed.append('tests/test_behavior.py')
                    checked=subprocess.run(policy['checks']['apply'][0],cwd=p.root,text=True,capture_output=True)
                    self.assertEqual(checked.returncode,0,checked.stderr)
                    evidence=f'manager/runtime/evidence/{cid}-behavior.txt'; p.write(evidence,checked.stdout+checked.stderr)
                    result=f'manager/runtime/evidence/{cid}-task.json'
                    p.write(result,json.dumps({'run_id':claim['run_id'],'agent_id':'fixture-worker-'+cid,'contract':claim['contract'],'status':'completed','changed_files':changed,'checks':[{'status':'passed','evidence':evidence}]}))
                    tasks.finish(store,claim['run_id'],result)
                    self.assertTrue(gate.run(store,entry,'apply',p.report(store,cid))['ok'])
                    flow.advance(store,entry,'apply')
                footer=flow.round_finish(store,sid)['footer']
                self.assertEqual(footer,'MANAGER-RUN: STOP(milestone)' if index==3 else 'MANAGER-RUN: CONTINUE')
            flow.approve_milestone(store,'m2','TEST ONLY: simulated product acceptance')
            for cid in ('example','child'):
                entry=store.entry(cid)
                self.assertTrue(gate.run(store,entry,'apply',p.report(store,cid))['ok'])
                ticket=archive.prepare(store,entry,'TEST ONLY: explicit archive')
                subprocess.run(ticket['operator_command'],cwd=p.root,check=True,capture_output=True)
                destination=next((p.root/'openspec/changes/archive').glob('*-'+cid))
                archive.finalize(store,ticket['ticket'],str(destination.relative_to(p.root)))
                self.assertTrue(store.proof(cid))
            archive.prune(store,['example','child'],'TEST ONLY: prune')
            self.assertEqual(p.store().plan['openspec'],[])

if __name__ == '__main__': unittest.main()
