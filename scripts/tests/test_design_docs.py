"""App-owned design docs keep the shared navigation and hygiene checks."""
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parents[1]))
from check_docs import active_files, hygiene_errors, link_errors, prose_errors, validate


class ClientDesignDocumentationChecks(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        for name in ("AGENTS.md", "frontend/AGENTS.md", "miniprogram/AGENTS.md",
                     "backend/AGENTS.md", "ai-service/AGENTS.md"):
            self.write(name, "# Routing\n")

    def write(self, name: str, content: str) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_nested_design_docs_and_broken_links_are_checked(self) -> None:
        for app in ("frontend", "miniprogram"):
            with self.subTest(app=app):
                path = self.write(f"{app}/design/flows/example.md", "[missing](absent.md)\n")
                self.assertIn(path, active_files(self.root))
                self.assertTrue(any(f"{app}/design/flows/example.md: broken link" in error
                                    for error in validate(self.root)))

    def test_design_prose_uses_the_same_hygiene_rules(self) -> None:
        for app in ("frontend", "miniprogram"):
            with self.subTest(app=app):
                path = self.write(f"{app}/design/ui-spec.md", "# Rules\n我会帮你修改。\n")
                self.assertEqual(len(prose_errors(self.root, path)), 1)
                path.write_text("# Rules\n```text\nAssistant: example\n```\n", encoding="utf-8")
                self.assertEqual(prose_errors(self.root, path), [])

    def test_scan_does_not_expand_to_runtime_dependencies_or_archives(self) -> None:
        for app in ("frontend", "miniprogram"):
            for tail in ("src/prompt.md", "node_modules/demo/README.md", "design/archive/old.md"):
                path = self.write(f"{app}/{tail}", "[missing](absent.md)\n")
                self.assertNotIn(path, active_files(self.root))

    def test_shared_policy_and_local_design_roots_are_allowed(self) -> None:
        shared = self.write("docs/design/tokens.md", "# Shared palette\n")
        for app in ("frontend", "miniprogram"):
            path = self.write(f"{app}/design/README.md", "[shared](../../docs/design/tokens.md)\n")
            self.assertIn(path, active_files(self.root))
            self.assertEqual(link_errors(self.root, path), [])
        self.assertIn(shared, active_files(self.root))
        self.assertEqual(validate(self.root), [])

    def test_removed_platform_locations_are_rejected(self) -> None:
        for name in ("docs/design/ui-spec.md", "docs/design/mobile/ui-spec.md",
                     "docs/design/design-system/core.lib.pen"):
            with self.subTest(name=name):
                self.write(name, "legacy")
                self.assertTrue(any("legacy or duplicate root" in error
                                    for error in hygiene_errors(self.root)))

    def test_design_guidance_rejects_retired_asset_paths(self) -> None:
        for app in ("frontend", "miniprogram"):
            with self.subTest(app=app):
                path = self.write(f"{app}/design/README.md", "Use `docs/design/design-system/core.lib.pen`.\n")
                self.assertTrue(any(f"{path.relative_to(self.root)}: stale execution" in error
                                    for error in hygiene_errors(self.root)))
