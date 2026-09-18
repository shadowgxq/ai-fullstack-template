import importlib.util
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parents[1]))
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
            self.assertGreaterEqual(len(errors), 3)
            self.assertTrue(any("missing path" in e for e in errors))

    def test_agents_length_gate(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "AGENTS.md").write_text("rule\n" * 61)
            self.assertTrue(any("exceeds 60" in e for e in module.validate(root)))


    def test_skill_guidance_is_included_and_validated(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            skill = root / ".agents/skills/demo/SKILL.md"
            skill.parent.mkdir(parents=True)
            skill.write_text("[bad](missing.md)\nRead `docs/frontend/README.md`.")
            self.assertIn(skill, module.active_files(root))
            self.assertTrue(module.link_errors(root, skill))
            self.assertTrue(any("stale execution" in e for e in module.hygiene_errors(root)))

    def test_duplicate_skill_and_legacy_worktree_are_rejected(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            for folder in (".agents/skills/demo", ".codex/skills/demo"):
                p = root / folder
                p.mkdir(parents=True)
                (p / "SKILL.md").write_text("# Demo")
            (root / "frontend-agent-template").mkdir()
            errors = module.hygiene_errors(root)
            self.assertTrue(any("duplicate skill" in e for e in errors))
            self.assertTrue(any("frontend-agent-template" in e for e in errors))

    def test_local_link_cannot_escape_repository(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            p = root / "README.md"
            p.write_text("[escape](../outside.md)")
            self.assertTrue(any("escapes" in e for e in module.link_errors(root, p)))
