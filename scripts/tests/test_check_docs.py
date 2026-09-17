import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("check_docs", Path(__file__).parents[1] / "check_docs.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DocumentationChecks(unittest.TestCase):
    def test_local_links_and_external_links(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            path = root / "README.md"
            path.write_text("[bad](missing.md) [web](https://example.com) [ok](target.md)\n```\n[x](placeholder)\n```\n")
            (root / "target.md").write_text("# Target\n")
            errors = module.link_errors(root, path)
            self.assertEqual(len(errors), 1)
            self.assertIn("missing.md", errors[0])

    def test_plan_references_are_checked(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "manager").mkdir()
            (root / "docs/product").mkdir(parents=True)
            (root / "manager/plan.yaml").write_text("requirements:\n  - id: REQ-TEST-001\n    source: missing.md\n    requirements:\n      - REQ-TEST-002\n")
            errors = module.plan_errors(root)
            self.assertEqual(len(errors), 3)
            self.assertTrue(any("undefined requirement" in e for e in errors))

    def test_agents_length_gate(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "AGENTS.md").write_text("rule\n" * 61)
            self.assertTrue(any("exceeds 60" in e for e in module.validate(root)))
