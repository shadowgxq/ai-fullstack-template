"""Input-registry regression tests; no network or model calls required."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'manager-execute-current-batch' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
from plan_inputs import InputError, input_issues, normalize_inputs, resolve_inputs, consumers
import plan_tool


def resource(id='api-contract', **overrides):
    return dict(id=id, kind='api-contract', source='docs/api/contracts.md', required=True, **overrides)


def entry(id, inputs=None, refs=None):
    result = dict(id=id, phase='change', state='planned', requirements=['req-example'])
    if inputs is not None:
        result['inputs'] = deepcopy(inputs)
    if refs is not None:
        result['input_refs'] = list(refs)
    return result


def plan(*entries, shared=None):
    result = dict(version=2, updated_at='2026-09-22',
                  current=dict(title='Example', batch='m1', wave='w1', next='execute'),
                  requirements=[dict(id='req-example', source='docs/prd/example.md', acceptance=['Expected behavior'])],
                  openspec=list(entries), batches=[dict(id='m1', goal='Example', waves=[dict(id='w1', parallel=True, openspec=[e['id'] for e in entries])])])
    if shared is not None:
        result['inputs'] = deepcopy(shared)
    return result


class ResolutionTests(unittest.TestCase):
    def test_legacy_inline(self):
        e = entry('a', [resource()])
        self.assertEqual(resolve_inputs(plan(e), e), [resource()])

    def test_no_inputs_does_not_inherit_registry(self):
        e = entry('a')
        self.assertEqual(resolve_inputs(plan(e, shared=[resource()]), e), [])

    def test_refs_and_private_input(self):
        private = resource('test-data')
        private['kind'] = 'test-data'
        private['source'] = 'fixtures/data.json'
        e = entry('a', [private], ['api-contract'])
        self.assertEqual(resolve_inputs(plan(e, shared=[resource()]), e), [resource(), private])

    def test_returns_copies_for_parallel_workers(self):
        e = entry('a', refs=['api-contract'])
        p = plan(e, shared=[resource(scope=['heading:Shared', 'operation-id:listTodos'])])
        got = resolve_inputs(p, e)
        got[0]['scope'].append('unexpected')
        got[0]['status'] = 'read'
        self.assertNotIn('status', p['inputs'][0])
        self.assertEqual(len(p['inputs'][0]['scope']), 2)

    def test_unknown_ref_is_error(self):
        e = entry('a', refs=['missing'])
        with self.assertRaises(InputError):
            resolve_inputs(plan(e), e)

    def test_ref_cannot_resolve_from_other_change(self):
        p = plan(entry('a', [resource()]), entry('b', refs=['api-contract']))
        self.assertTrue(input_issues(p)[0])

    def test_global_local_shadowing_rejected(self):
        p = plan(entry('a', [resource()], ['api-contract']), shared=[resource()])
        self.assertTrue(input_issues(p)[0])

    def test_duplicate_ref_rejected(self):
        p = plan(entry('a', refs=['api-contract', 'api-contract']), shared=[resource()])
        self.assertTrue(input_issues(p)[0])

    def test_duplicate_registry_id_rejected(self):
        p = plan(entry('a', refs=['api-contract']), shared=[resource(), resource()])
        self.assertTrue(input_issues(p)[0])

    def test_snapshot_optional_and_unknown_metadata_preserved(self):
        r = resource(snapshot='snapshots/api.json', scope=['operation-id:listTodos'], owner='api-team')
        r['required'] = False
        p = plan(entry('a', refs=['api-contract']), shared=[r])
        self.assertEqual(resolve_inputs(p, p['openspec'][0]), [r])

    def test_malformed_shapes_report_without_crash(self):
        for shared in ({}, None, 'api'):
            with self.subTest(shared=shared):
                p = plan(entry('a'))
                p['inputs'] = shared
                self.assertTrue(input_issues(p)[0])
        for refs in ({}, None, 'api', [None], [False], ['x', 'x']):
            with self.subTest(refs=refs):
                p = plan(entry('a'))
                p['openspec'][0]['input_refs'] = refs
                self.assertTrue(input_issues(p)[0])

    def test_legacy_scope_variants_resolve_independently(self):
        a = entry('a', [resource(scope=['heading:A'])])
        b = entry('b', [resource(scope=['heading:B'])])
        p = plan(a, b)
        self.assertEqual(input_issues(p)[0], [])
        self.assertNotEqual(resolve_inputs(p, a), resolve_inputs(p, b))

    def test_consumers_include_refs_and_legacy_inline(self):
        p = plan(entry('a', refs=['api-contract']), entry('b'), shared=[resource()])
        self.assertEqual(consumers(p, 'api-contract'), ['a'])
        self.assertEqual(consumers(plan(entry('a', [resource()]), entry('b')), 'api-contract'), ['a'])


class NormalizationTests(unittest.TestCase):
    def test_hoists_common_keeps_private_and_plan_state(self):
        private = resource('private', scope=['heading:Private'])
        p = plan(entry('a', [resource(), private]), entry('b', [resource()]))
        original = deepcopy(p)
        normalized, report = normalize_inputs(p)
        self.assertEqual(p, original)
        self.assertEqual(normalized['inputs'], [resource()])
        self.assertEqual(normalized['openspec'][0]['inputs'], [private])
        self.assertEqual(normalized['openspec'][0]['input_refs'], ['api-contract'])
        for key in ('current', 'requirements', 'batches', 'updated_at'):
            self.assertEqual(normalized[key], p[key])
        self.assertEqual(report['definitions_before'], 3)
        self.assertEqual(report['definitions_after'], 2)
        self.assertEqual(input_issues(normalized, strict=True)[0], [])

    def test_no_hoist_for_single_consumer(self):
        p = plan(entry('a', [resource()]))
        self.assertEqual(normalize_inputs(p)[0], p)

    def test_idempotent(self):
        p = plan(entry('a', [resource()]), entry('b', [resource()]))
        n, _ = normalize_inputs(p)
        self.assertEqual(normalize_inputs(n)[0], n)

    def test_scope_and_required_are_not_merged(self):
        for field, value in (('scope', ['heading:Other']), ('required', False), ('snapshot', 'snapshots/other.json')):
            p = plan(entry('a', [resource()]), entry('b', [resource()]))
            p['openspec'][1]['inputs'][0][field] = value
            n, report = normalize_inputs(p)
            self.assertEqual(n, p)
            self.assertEqual(report['definitions_after'], 2)

    def test_distinct_ids_are_not_renamed(self):
        p = plan(entry('a', [resource('first')]), entry('b', [resource('second')]))
        self.assertEqual(normalize_inputs(p)[0], p)
        self.assertTrue(input_issues(p, strict=True)[0])

    def test_registry_is_not_auto_applied_to_unrelated_change(self):
        p = plan(entry('a', [resource()]), entry('b', [resource()]), entry('other'))
        n, _ = normalize_inputs(p)
        self.assertEqual(resolve_inputs(n, n['openspec'][2]), [])

    def test_never_deletes_project_guidance(self):
        r = resource()
        r['kind'] = 'frontend-standard'
        p = plan(entry('a', [r]), entry('b', [r]))
        n, _ = normalize_inputs(p)
        self.assertEqual(resolve_inputs(n, n['openspec'][0]), [r])
        self.assertTrue(input_issues(n, strict=True)[0])

    def test_invalid_reference_cannot_be_normalized_away(self):
        with self.assertRaises(InputError):
            normalize_inputs(plan(entry('a', refs=['missing'])))


class AdditionalBoundaryTests(unittest.TestCase):
    def test_nested_registry_references_are_rejected(self):
        r = resource(); r['input_refs'] = ['other']
        with self.assertRaises(InputError):
            resolve_inputs(plan(entry('a', [r])), entry('a', [r]))

    def test_normalization_preserves_terminal_plan_records(self):
        for terminal in ('done', 'cancelled'):
            p = plan(entry('a', [resource()]), entry('b', [resource()]))
            if terminal == 'done':
                p['openspec'][1]['phase'] = 'done'
                p['openspec'][1].pop('state')
            else:
                p['openspec'][1]['state'] = 'cancelled'
            n, report = normalize_inputs(p)
            self.assertEqual(n, p)
            self.assertEqual(report['promoted'], [])

    def test_schema_example_can_be_resolved_and_validated(self):
        import re
        text = (ROOT / 'manager-plan-from-doc/references/manager-plan-schema.md').read_text()
        p = yaml.safe_load(re.search(r'```yaml\n(.*?)```', text, re.S).group(1))
        self.assertEqual(input_issues(p, strict=True), ([], []))
        self.assertEqual(resolve_inputs(p, p['openspec'][0])[0]['id'], 'shared-api')


class PolicyTests(unittest.TestCase):
    def test_governance_is_warning_for_legacy_error_for_new_plan(self):
        for kind in ('frontend-standard', 'architecture-guidance', 'component-guidance', 'source-foundation', 'documentation-guidance'):
            r = resource(); r['kind'] = kind
            p = plan(entry('a', [r]))
            self.assertEqual(input_issues(p)[0], [])
            self.assertTrue(input_issues(p)[1])
            self.assertTrue(input_issues(p, strict=True)[0])

    def test_shared_input_repetition_is_strict_error(self):
        p = plan(entry('a', [resource()]), entry('b', [resource()]))
        self.assertEqual(input_issues(p)[0], [])
        self.assertTrue(input_issues(p, strict=True)[0])

    def test_unused_registry_is_visible(self):
        self.assertTrue(input_issues(plan(entry('a'), shared=[resource()]), strict=True)[0])

    def test_technical_design_is_not_duplicated_as_input(self):
        e = entry('a', [resource()]); e['technical_design'] = ['docs/api/contracts.md']
        self.assertTrue(input_issues(plan(e), strict=True)[0])

    def test_no_filename_based_dropping_of_real_baselines(self):
        r = resource(); r.update(kind='acceptance-baseline', source='docs/engineering/permission-matrix.md', scope=['id:permissions'])
        self.assertEqual(input_issues(plan(entry('a', [r])), strict=True), ([], []))

    def test_ordinary_metadata_does_not_change_interpretation(self):
        e = entry('a'); e['input_refs'] = []
        self.assertEqual(resolve_inputs(plan(e), e), [])


class CliTests(unittest.TestCase):
    def run_cli(self, path, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / 'plan_tool.py'), '--plan', str(path), *args], text=True, capture_output=True, timeout=10)

    def test_next_expands_only_selected_references(self):
        p = plan(entry('a', refs=['api-contract']), entry('b'), shared=[resource()])
        result = plan_tool.select_next(p, 'change-only')
        selected = result['selected']['entries']
        self.assertEqual(selected[0]['inputs'], [resource()])
        self.assertEqual(selected[1]['inputs'], [])

    def test_normalize_preview_and_exclusive_output(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'plan.yaml'
            path.write_text(yaml.safe_dump(plan(entry('a', [resource()]), entry('b', [resource()]))), encoding='utf-8')
            before = path.read_bytes()
            run = self.run_cli(path, 'normalize-inputs')
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(path.read_bytes(), before)
            output = Path(td) / 'normalized.yaml'
            run = self.run_cli(path, 'normalize-inputs', '--output', str(output))
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(path.read_bytes(), before)
            self.assertNotEqual(output.read_bytes(), before)
            self.assertNotEqual(self.run_cli(path, 'normalize-inputs', '--output', str(output)).returncode, 0)
            self.assertNotEqual(self.run_cli(path, 'normalize-inputs', '--output', str(path)).returncode, 0)
            valid = self.run_cli(output, 'validate', '--strict-inputs')
            self.assertEqual(valid.returncode, 0, valid.stdout + valid.stderr)

    def test_invalid_ref_blocks_next_and_start_without_writes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'plan.yaml'
            path.write_text(yaml.safe_dump(plan(entry('a', refs=['missing']))), encoding='utf-8')
            before = path.read_bytes()
            for args in (('next',), ('start', '--change', 'a')):
                run = self.run_cli(path, *args)
                self.assertNotEqual(run.returncode, 0)
                self.assertNotIn('Traceback', run.stderr)
                self.assertEqual(path.read_bytes(), before)

    def test_resolve_inputs_cli_is_read_only(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'plan.yaml'
            path.write_text(yaml.safe_dump(plan(entry('a', refs=['api-contract']), shared=[resource()])), encoding='utf-8')
            before = path.read_bytes()
            run = self.run_cli(path, 'resolve-inputs', '--change', 'a')
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertEqual(json.loads(run.stdout)['inputs'], [resource()])
            self.assertEqual(path.read_bytes(), before)


class TeamSiteRegressionTests(unittest.TestCase):
    def load_fixture(self):
        return yaml.safe_load((ROOT / 'tests/fixtures/team-site-inputs.yaml').read_text(encoding='utf-8'))

    def test_real_input_shape_59_to_15_without_semantic_removal(self):
        p = self.load_fixture()
        n, report = normalize_inputs(p)
        self.assertEqual(report['definitions_before'], 59)
        self.assertEqual(report['definitions_after'], 15)
        self.assertEqual(len(n['inputs']), 14)
        for before, after in zip(p['openspec'], n['openspec']):
            self.assertEqual({i['id']: i for i in resolve_inputs(p, before)}, {i['id']: i for i in resolve_inputs(n, after)})
        self.assertTrue(input_issues(n, strict=True)[0])  # Guidance still requires semantic review.

    def test_reviewed_classification_leaves_only_contract_references(self):
        p = self.load_fixture()
        # Case-specific, reviewed policy: existing AGENTS routes project guidance;
        # source exploration is not a pinned input; technical designs have a typed channel.
        # The generic normalizer must never perform these removals itself.
        for e in p['openspec']:
            e['inputs'] = [i for i in e['inputs'] if i['id'] == 'team-site-formal-api-contract']
        n, report = normalize_inputs(p)
        self.assertEqual(report['definitions_before'], 4)
        self.assertEqual(report['definitions_after'], 1)
        self.assertEqual(input_issues(n, strict=True), ([], []))
        self.assertEqual(resolve_inputs(n, n['openspec'][0]), [])  # Producer must not consume its uncreated output.
        self.assertEqual(consumers(n, 'team-site-formal-api-contract'), ['team-site-todos', 'team-site-announcements', 'team-site-resources', 'team-site-overview'])
        self.assertEqual(n['openspec'][1]['depends_on'], ['team-site-api-contract'])

    def test_snapshot_for_archive_does_not_depend_on_later_registry_edit(self):
        p = plan(entry('a', refs=['api-contract']), shared=[resource()])
        snapshot = resolve_inputs(p, p['openspec'][0])
        p['inputs'][0]['source'] = 'docs/api/new-contract.md'
        self.assertEqual(snapshot[0]['source'], 'docs/api/contracts.md')

    def test_v2_compact_schema_validates(self):
        with tempfile.TemporaryDirectory() as td:
            p = plan(entry('a', refs=['api-contract']), shared=[resource()])
            p.pop('updated_at')
            p['current'] = {'batch': 'm1', 'wave': 'w1'}
            path = Path(td) / 'plan.yaml'
            path.write_text(yaml.safe_dump(p), encoding='utf-8')
            run = subprocess.run([sys.executable, str(SCRIPTS / 'plan_tool.py'), '--plan', str(path), 'validate', '--strict-inputs'], capture_output=True, text=True, timeout=10)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)


if __name__ == '__main__':
    unittest.main()
