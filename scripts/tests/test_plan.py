from pathlib import Path
import sys
import tempfile
import unittest
import yaml
sys.path.insert(0, str(Path(__file__).parents[1]))
from manager.validate_plan import validate_plan

class PlanChecks(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(); self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name); (self.root / 'manager').mkdir()
        self.path = self.root / 'manager/plan.yaml'
        self.plan = {'version': 2, 'requirements': [{'id': 'req-test', 'source': 'docs/product/feature.md', 'acceptance': ['User can save.']}],
          'openspec': [{'id': 'feature', 'phase': 'change', 'state': 'planned', 'requirements': ['req-test'], 'technical_design': ['docs/architecture/feature.md']}],
          'batches': [{'id': 'm1', 'goal': 'Save', 'waves': [{'id': 'w1', 'openspec': ['feature']}]}]}
    def errors(self):
        self.path.write_text(yaml.safe_dump(self.plan)); return validate_plan(self.path)
    def test_planned_change_does_not_need_fake_artifacts(self):
        self.assertEqual(self.errors(), [])
    def test_wrong_current_wave(self):
        self.plan['current'] = {'batch': 'm1', 'wave': 'missing'}
        self.assertTrue(any('current' in e for e in self.errors()))
    def test_cycle_and_missing_dependency(self):
        self.plan['openspec'][0]['depends_on'] = ['feature', 'missing']
        errors = ';'.join(self.errors()); self.assertIn('cycle', errors); self.assertIn('dependency', errors)
    def test_duplicate_id(self):
        self.plan['openspec'] *= 2
        self.assertTrue(any('duplicate' in e for e in self.errors()))
    def test_acceptance_cannot_disappear(self):
        self.plan['requirements'][0].pop('acceptance')
        self.assertTrue(any('acceptance' in e for e in self.errors()))
    def test_old_state_is_not_silently_accepted(self):
        self.plan['openspec'][0].update(phase='verify', state='ready_for_review')
        self.assertTrue(any('invalid' in e for e in self.errors()))
    def test_path_traversal_rejected(self):
        self.plan['requirements'][0]['source'] = '../escape.md'
        self.assertTrue(any('escapes' in e for e in self.errors()))
    def test_done_requires_a_real_completion_proof(self):
        self.plan['openspec'][0].update(phase='done'); self.plan['openspec'][0].pop('state')
        self.assertTrue(self.errors())
    def test_duplicate_mapping_keys_rejected(self):
        self.path.write_text('current: {}\ncurrent: {}\n')
        self.assertTrue(any('duplicate' in e for e in validate_plan(self.path)))
    def test_validate_is_readonly(self):
        self.assertEqual(self.errors(), []); self.assertFalse((self.root/'manager/runtime').exists())
    def test_missing_registry_reference_rejected(self):
        self.plan['openspec'][0]['input_refs'] = ['missing']
        self.assertTrue(self.errors())
