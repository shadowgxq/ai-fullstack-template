from pathlib import Path
import sys
import tempfile
import unittest
import yaml
sys.path.insert(0, str(Path(__file__).parents[1]))
from manager.validate_plan import validate_plan


class PlanChecks(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / "manager").mkdir()
        self.path = self.root / "manager/plan.yaml"
        self.source = self.root / "docs/product/feature.md"
        self.source.parent.mkdir(parents=True)
        self.source.write_text("REQ-TEST-001")
        self.change = self.root / "openspec/changes/feature"
        self.change.mkdir(parents=True)
        (self.change / "tasks.md").write_text("- [ ] not complete")
        self.plan = {
            "updated_at": "2026-09-18",
            "current": {"title": "Test", "batch": "b", "wave": "w", "next": "run"},
            "requirements": [{"id": "REQ-TEST-001", "source": "docs/product/feature.md"}],
            "openspec": [{"id": "feature", "phase": "apply", "state": "in_progress", "requirements": ["REQ-TEST-001"],
                          "path": "openspec/changes/feature", "tasks": "openspec/changes/feature/tasks.md", "depends_on": []}],
            "batches": [{"id": "b", "waves": [{"id": "w", "openspec": ["feature"]}]}],
        }

    def errors(self):
        self.path.write_text(yaml.safe_dump(self.plan))
        return validate_plan(self.path)

    def test_valid_minimum(self):
        self.assertEqual(self.errors(), [])

    def test_wrong_current_wave(self):
        self.plan["current"]["wave"] = "missing"
        self.assertTrue(any("current.wave" in e for e in self.errors()))

    def test_cycle_and_missing_dependency(self):
        self.plan["openspec"][0]["depends_on"] = ["feature", "missing"]
        errors = self.errors()
        self.assertTrue(any("cycle" in e for e in errors))
        self.assertTrue(any("undefined dependency" in e for e in errors))

    def test_each_requirement_must_exist_in_its_own_source(self):
        self.source.write_text("Not the correct requirement")
        (self.source.parent / "other.md").write_text("REQ-TEST-001")
        self.assertTrue(any("own source" in e for e in self.errors()))

    def test_review_requires_completed_tasks_and_evidence(self):
        self.plan["openspec"][0].update(state="ready_for_review", phase="verify")
        errors = self.errors()
        self.assertTrue(any("completed tasks" in e for e in errors))
        self.assertTrue(any("verification.md" in e for e in errors))

    def test_path_traversal_rejected(self):
        self.plan["requirements"][0]["source"] = "../escape.md"
        self.assertTrue(any("escapes" in e for e in self.errors()))

    def test_archived_path_state_mismatch(self):
        self.plan["openspec"][0].update(state="archived", phase="archive")
        self.assertTrue(any("archive path/state" in e for e in self.errors()))

    def test_duplicate_mapping_keys_rejected(self):
        self.path.write_text("current: {}\ncurrent: {}\n")
        self.assertTrue(any("duplicate mapping key" in e for e in validate_plan(self.path)))
