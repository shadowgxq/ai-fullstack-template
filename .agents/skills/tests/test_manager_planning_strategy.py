"""Planning precedence and real runtime transitions with repository test fixtures.

OpenSpec/Agent identities in Project are test doubles, not native product acceptance.
The existing CI separately exercises the real OpenSpec validation/archive lifecycle.
"""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_manager_runtime import Project, SCRIPTS
from manager_schema import Invalid, parse, validate
from manager_store import Store
import manager_flow as flow
import manager_gate as gate
import manager_archive as archive
import plan_tool


class PlanningResolutionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.store = Store(self.root / 'manager/plan.yaml')

    def tearDown(self):
        self.tmp.cleanup()

    def policy(self, text):
        path = self.root / 'manager/policy.yaml'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def test_default_auto_does_not_create_plan_or_runtime(self):
        self.assertEqual(flow.resolve_planning(self.store), {'requested': 'auto', 'source': 'auto'})
        self.assertEqual(list(self.root.iterdir()), [])

    def test_project_default(self):
        self.policy('planning: rolling\n')
        self.assertEqual(flow.resolve_planning(self.store), {'requested': 'rolling', 'source': 'project'})

    def test_explicit_user_overrides_project_including_auto(self):
        self.policy('planning: rolling\n')
        for mode in ('auto', 'full', 'rolling'):
            with self.subTest(mode=mode):
                self.assertEqual(flow.resolve_planning(self.store, mode), {'requested': mode, 'source': 'user'})

    def test_invalid_values_do_not_silently_fall_back(self):
        for text in ('planning: mixed\n', 'planning: null\n', 'planning: [auto]\n', '[]\n', 'planning: auto\nplanning: full\n'):
            with self.subTest(policy=text):
                self.policy(text)
                with self.assertRaises(Invalid):
                    flow.resolve_planning(self.store)
        self.policy('planning: auto\n')
        with self.assertRaises(Invalid):
            flow.resolve_planning(self.store, 'mixed')

    def test_cli_before_plan_exists_is_read_only(self):
        proc = subprocess.run([sys.executable, str(SCRIPTS / 'plan_tool.py'), '--plan', str(self.store.path), 'resolve-planning', '--planning', 'full'], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout), {'requested': 'full', 'source': 'user'})
        self.assertEqual(list(self.root.iterdir()), [])

    def test_cli_rejects_unknown_parameter_value(self):
        proc = subprocess.run([sys.executable, str(SCRIPTS / 'plan_tool.py'), 'resolve-planning', '--planning', 'mixed'], capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)

    def test_capabilities_and_help_expose_actual_command(self):
        self.assertIn('resolve-planning', plan_tool.COMMANDS)
        self.assertEqual(plan_tool.parser().parse_args(['resolve-planning', '--planning', 'rolling']).planning, 'rolling')


class PlanningSessionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Project(self.tmp.name)
        self.p.add('child', ['example'], batch='m2')
        for batch in self.p.plan['batches']:
            batch['checkpoint'] = 'auto'
        self.p.save()

    def tearDown(self):
        self.p.close()
        self.tmp.cleanup()

    def open(self, batches=('m1', 'm2'), rounds=12):
        store = self.p.approved()
        return flow.session_open(store, list(batches), rounds, 'test-only explicit execution scope')['session']

    def begin(self, session):
        return flow.round_begin(self.p.store(), session)

    def execute(self, selection, approve=True, write_code=True):
        for item in selection['entries']:
            store = self.p.store()
            entry = store.entry(item['id'])
            stage = selection['stage']
            flow.start(store, entry, 'test-implementer')
            if stage == 'apply':
                if write_code:
                    self.p.write(f'src/{item["id"]}.py', 'value = 2\n')
                self.p.write(f'openspec/changes/{item["id"]}/tasks.md', '## Implementation\n- [x] T1 Implement example\n')
                result = gate.run(store, entry, stage, self.p.report(store, item['id']))
            else:
                result = gate.run(store, entry, stage)
            self.assertTrue(result['ok'], result)
            flow.advance(store, entry, stage)
            if stage == 'change' and approve:
                flow.set_review(store, entry, 'approved', 'test-only artifact approval')

    def run_round(self, session, **kwargs):
        begun = self.begin(session)
        self.assertIn('selection', begun, begun)
        self.execute(begun['selection'], **kwargs)
        return flow.round_finish(self.p.store(), session)

    def cross_first(self, session):
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: CONTINUE')
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: CONTINUE')

    def test_two_batches_continue_without_replan_or_fake_product_approval(self):
        session = self.open()
        self.cross_first(session)
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: CONTINUE')
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: STOP(no-work)')
        store = self.p.store()
        self.assertEqual([e['phase'] for e in store.plan['openspec']], ['archive', 'archive'])
        self.assertEqual(store.state['milestones'], {})
        self.assertEqual(store.state['completed'], {})
        self.assertEqual(set(store.state['sessions'][session]['checkpoints']), {'m1', 'm2'})
        self.assertEqual(len(store.plan['batches']), 2)

    def test_unauthorized_later_batch_is_not_selected(self):
        session = self.open(('m1',))
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: CONTINUE')
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: STOP(no-work)')
        self.assertEqual(self.p.store().entry('child')['phase'], 'change')
        self.assertNotIn('child', self.p.store().state['starts'])

    def test_legacy_missing_checkpoint_preserves_manual_stop(self):
        self.p.plan['batches'][0].pop('checkpoint')
        self.p.save()
        session = self.open()
        self.run_round(session)
        self.assertEqual(self.run_round(session)['footer'], 'MANAGER-RUN: STOP(milestone)')
        self.assertEqual(self.p.store().entry('child')['phase'], 'change')
        with self.assertRaisesRegex(Invalid, 'stopped'):
            self.begin(session)
        store = self.p.store()
        flow.approve_milestone(store, 'm1', 'test-only actual milestone approval')
        resumed = flow.session_open(store, ['m1', 'm2'], 8, 'test-only new scope')['session']
        self.assertEqual(self.begin(resumed)['selection']['batch'], 'm2')

    def test_mixed_planning_boundary_is_not_automatic_replanning(self):
        self.p.plan['batches'][0]['planning_boundary'] = 'docs/prd/example.md: next scope requires real-data findings'
        self.p.save()
        session = self.open()
        self.run_round(session)
        result = self.run_round(session)
        self.assertEqual(result['footer'], 'MANAGER-RUN: STOP(planning-boundary)')
        self.assertIn('real-data', result['held'][0]['reason'])
        self.assertNotIn('child', self.p.store().state['starts'])

    def test_full_planning_does_not_create_technical_approval(self):
        store = self.p.store()
        before = deepcopy(store.state)
        self.assertEqual(flow.resolve_planning(store, 'full')['requested'], 'full')
        self.assertEqual(store.state, before)
        session = flow.session_open(store, ['m1', 'm2'], 8, 'test-only execution scope')['session']
        self.assertEqual(self.begin(session)['footer'], 'MANAGER-RUN: STOP(held)')
        self.assertEqual(self.p.store().state['starts'], {})

    def test_change_approval_boundary_is_preserved(self):
        session = self.open()
        self.assertEqual(self.run_round(session, approve=False)['footer'], 'MANAGER-RUN: STOP(boundary)')
        self.assertEqual(self.p.store().entry('example')['review'], 'pending')

    def test_first_checkpoint_rejects_stale_integration_gate(self):
        session = self.open()
        self.run_round(session)
        selection = self.begin(session)['selection']
        self.execute(selection)
        self.p.write('src/unverified.py', 'not_checked = True\n')
        result = flow.round_finish(self.p.store(), session)
        self.assertEqual(result['footer'], 'MANAGER-RUN: STOP(held)')
        self.assertIn('stale', result['held'][0]['reason'])

    def test_subsequent_code_changes_do_not_invalidate_prior_checkpoint(self):
        session = self.open()
        self.cross_first(session)
        self.run_round(session)
        selection = self.begin(session)['selection']
        self.execute(selection)
        # child changes the whole-code hash; the earlier verified contract remains valid.
        result = flow.round_finish(self.p.store(), session)
        self.assertEqual(result['footer'], 'MANAGER-RUN: STOP(no-work)')

    def test_saved_checkpoint_still_rejects_changed_evidence(self):
        session = self.open()
        self.cross_first(session)
        self.p.write('manager/runtime/evidence/check.txt', 'tampered\n')
        result = self.begin(session)
        self.assertEqual(result['footer'], 'MANAGER-RUN: STOP(held)')
        self.assertIn('evidence', result['held'][0]['reason'])

    def test_saved_checkpoint_rejects_changed_contract(self):
        session = self.open()
        self.cross_first(session)
        self.p.write('openspec/changes/example/design.md', 'changed design\n')
        self.assertEqual(self.begin(session)['footer'], 'MANAGER-RUN: STOP(held)')

    def test_manual_acceptance_revocation_is_not_hidden_by_saved_checkpoint(self):
        self.p.plan['batches'][0]['checkpoint'] = 'manual'
        self.p.save()
        store = self.p.archive_ready()
        flow.approve_milestone(store, 'm1', 'test-only human acceptance')
        session = flow.session_open(store, ['m1', 'm2'], 8, 'test-only scope')['session']
        begun = self.begin(session)
        self.execute(begun['selection'])
        self.assertEqual(flow.round_finish(self.p.store(), session)['footer'], 'MANAGER-RUN: CONTINUE')
        store = self.p.store()
        store.state['milestones'].pop('m1')
        store.commit()
        self.assertEqual(self.begin(session)['footer'], 'MANAGER-RUN: STOP(milestone)')

    def test_scope_change_cannot_silently_expand_running_session(self):
        session = self.open()
        store = self.p.store()
        store.plan['batches'][0]['goal'] = 'new scope'
        store.commit()
        with self.assertRaisesRegex(Invalid, 'scope changed'):
            self.begin(session)

    def test_scope_change_during_round_stops_on_finish(self):
        session = self.open()
        self.execute(self.begin(session)['selection'])
        store = self.p.store()
        store.plan['batches'][0]['checkpoint'] = 'manual'
        store.commit()
        self.assertEqual(flow.round_finish(self.p.store(), session)['footer'], 'MANAGER-RUN: STOP(held)')
        self.assertIsNone(self.p.store().state['sessions'][session]['open_round'])

    def test_cancelled_work_is_not_a_completed_batch(self):
        session = self.open()
        store = self.p.store()
        flow.cancel(store, ['example'], 'test-only cancellation')
        self.assertEqual(self.begin(session)['footer'], 'MANAGER-RUN: STOP(blocked)')
        self.assertEqual(self.p.store().state['sessions'][session]['checkpoints'], {})

    def test_no_progress_and_budget_still_stop(self):
        session = self.open()
        self.begin(session)
        self.assertEqual(flow.round_finish(self.p.store(), session)['footer'], 'MANAGER-RUN: STOP(no-progress)')
        second = self.open(rounds=1)
        self.assertEqual(self.run_round(second)['footer'], 'MANAGER-RUN: STOP(budget)')

    def test_open_round_is_recovered_not_duplicated(self):
        session = self.open()
        selection = self.begin(session)['selection']
        with self.assertRaisesRegex(Invalid, 'unfinished round'):
            self.begin(session)
        self.execute(selection)
        self.assertEqual(flow.round_finish(self.p.store(), session)['footer'], 'MANAGER-RUN: CONTINUE')
        self.assertEqual(self.p.store().state['sessions'][session]['rounds'], 1)

    def test_duplicate_batch_scope_is_rejected(self):
        with self.assertRaisesRegex(Invalid, 'duplicate'):
            self.open(('m1', 'm1'))

    def test_schema_rejects_invalid_boundary_or_high_risk_auto(self):
        for field, value in (('checkpoint', 'skip'), ('checkpoint', False), ('planning_boundary', ''), ('planning_boundary', [])):
            plan = deepcopy(self.p.plan)
            plan['batches'][0][field] = value
            self.assertTrue(validate(plan)[0], (field, value))
        plan = deepcopy(self.p.plan)
        plan['openspec'][0]['risk'] = 'high'
        self.assertTrue(validate(plan)[0])
        plan['batches'][0]['checkpoint'] = 'manual'
        self.assertEqual(validate(plan)[0], [])

    def test_explicit_archive_proof_remains_usable_at_manual_checkpoint(self):
        self.p.plan['batches'][0]['checkpoint'] = 'manual'
        self.p.save()
        store = self.p.archive_ready()
        flow.approve_milestone(store, 'm1', 'test-only actual product acceptance')
        ticket = archive.prepare(store, store.entry('example'), 'test-only explicit archive')
        subprocess.run(ticket['operator_command'], cwd=self.p.root, check=True, capture_output=True)
        archive.finalize(store, ticket['ticket'], 'openspec/changes/archive/2026-09-22-example')
        session = flow.session_open(store, ['m1', 'm2'], 8, 'test-only authorized scope')['session']
        self.assertEqual(self.begin(session)['selection']['batch'], 'm2')
        self.assertTrue(self.p.store().proof('example'))

    def test_auto_checkpoint_never_accepts_missing_completed_proof(self):
        store, _ = self.p.archived()
        proof = self.p.root / 'manager/archive/completed/example.json'
        proof.unlink()
        session = flow.session_open(store, ['m1', 'm2'], 8, 'test-only authorized scope')['session']
        self.assertEqual(self.begin(session)['footer'], 'MANAGER-RUN: STOP(held)')
        self.assertEqual(self.p.store().state['milestones'], {})

    def test_schema_has_no_one_batch_limit(self):
        self.assertEqual(validate(self.p.plan, strict_inputs=True), ([], []))

    def test_existing_plan_and_runtime_are_unchanged_by_resolution(self):
        store = self.p.approved()
        before = (store.path.read_bytes(), store.state_path.read_bytes())
        proc = self.p.cli('resolve-planning', '--planning', 'rolling')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual((store.path.read_bytes(), store.state_path.read_bytes()), before)

    def test_compact_preserves_checkpoint_and_planning_boundary(self):
        self.p.plan['batches'][0]['planning_boundary'] = 'docs/prd/example.md: validate data'
        self.p.save()
        proc = self.p.cli('compact')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        batch = json.loads(proc.stdout)['plan']['batches'][0]
        self.assertEqual(batch['checkpoint'], 'auto')
        self.assertEqual(batch['planning_boundary'], self.p.plan['batches'][0]['planning_boundary'])


if __name__ == '__main__':
    unittest.main()
