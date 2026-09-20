"""Keep conversational residue out of docs without rejecting legitimate instructions."""
from pathlib import Path
import sys
import tempfile
import unittest

import yaml

sys.path.insert(0, str(Path(__file__).parents[1]))
from check_docs import prose_errors
from manager.validate_plan import validate_plan


class DocumentHygieneChecks(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def scan(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return prose_errors(self.root, path)

    def test_chat_residue_is_rejected_with_line_number(self):
        for text in ("我会帮你优化。", "本轮仅参考旧项目。", "Assistant: done", "fileciteturn2file0"):
            with self.subTest(text=text):
                errors = self.scan("docs/engineering/test.md", "# Rules\n\n" + text)
                self.assertEqual(len(errors), 1)
                self.assertIn("test.md:3:", errors[0])

    def test_examples_and_valid_technical_boundaries_are_allowed(self):
        text = "# Rules\n当前 SSE 尚未实现。\n本次发布需要迁移。\n```text\n我会帮你优化。\n```\n~~~~text\nAssistant: example\n~~~~~\n"
        self.assertEqual(self.scan("docs/engineering/test.md", text), [])
        errors = self.scan("docs/engineering/test.md", text + "我建议修改。\n")
        self.assertEqual(len(errors), 1)

    def test_agent_skill_prompt_and_task_records_are_not_prose(self):
        for name in ("AGENTS.md", "frontend/AGENTS.md", ".agents/skills/demo/SKILL.md",
                     "ai-service/src/ai_service/resources/demo/prompt.md",
                     "openspec/changes/demo/verification.md", "docs/templates/prompt.md"):
            with self.subTest(name=name):
                self.assertEqual(self.scan(name, "Assistant: example"), [])

    def write_plan(self, plan):
        path = self.root / "manager/plan.yaml"
        path.parent.mkdir(exist_ok=True)
        path.write_text(yaml.safe_dump(plan), encoding="utf-8")
        return validate_plan(path)

    def empty_plan(self):
        return {"updated_at": None, "current": {"title": "", "batch": None, "wave": None, "next": ""},
                "requirements": [], "openspec": [], "batches": []}

    def test_empty_template_requires_no_fake_date(self):
        self.assertEqual(self.write_plan(self.empty_plan()), [])

    def test_nonempty_or_malformed_plan_still_requires_update_date(self):
        for key, value in (("current", {"title": "Work", "batch": None, "wave": None, "next": "review"}),
                           ("requirements", [{"id": "REQ-TEST", "source": "missing.md"}]),
                           ("batches", None)):
            with self.subTest(key=key):
                plan = self.empty_plan()
                plan[key] = value
                self.assertIn("missing updated_at", self.write_plan(plan))
        plan = self.empty_plan()
        del plan["updated_at"]
        self.assertIn("missing updated_at", self.write_plan(plan))
