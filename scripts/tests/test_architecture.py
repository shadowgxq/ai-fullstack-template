import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("architecture", Path(__file__).parents[1] / "check_architecture.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchitectureChecks(unittest.TestCase):
    def check(self, file, content):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            path = root / file
            path.parent.mkdir(parents=True)
            path.write_text(content)
            return module.validate(root)

    def test_core_cannot_import_services(self):
        for content in ("import app.services.auth_service", "from ..services import auth_service", "from app import services"):
            self.assertTrue(self.check("backend/app/core/bad.py", content))

    def test_repository_cannot_commit(self):
        self.assertTrue(self.check("backend/app/repositories/bad.py", "def write(db): db.commit()"))
        self.assertFalse(self.check("backend/app/repositories/good.py", "def write(db): db.flush()"))

    def test_ai_application_depends_on_port_not_adapter(self):
        self.assertTrue(self.check("ai-service/src/ai_service/application/bad.py", "from ai_service.infrastructure.store import Store"))
        self.assertFalse(self.check("ai-service/src/ai_service/application/good.py", "from ai_service.agent_core.ports import RunStore"))

    def test_cross_service_import_is_rejected(self):
        self.assertTrue(self.check("backend/app/services/bad.py", "import ai_service"))

    def test_ai_inner_layers_cannot_import_composition_roots(self):
        for layer in ("agent_core", "application"):
            for target in ("bootstrap", "worker", "cli", "diagnostics", "config"):
                for content in (
                    f"import ai_service.{target}",
                    f"from ai_service import {target}",
                    f"from .. import {target}",
                ):
                    with self.subTest(layer=layer, content=content):
                        self.assertTrue(self.check(f"ai-service/src/ai_service/{layer}/bad.py", content))

    def test_ai_core_cannot_depend_on_application(self):
        self.assertTrue(self.check(
            "ai-service/src/ai_service/agent_core/bad.py",
            "from ai_service.application.runs import RunService",
        ))

    def test_workflow_uses_ports_not_storage_or_application(self):
        for target in ("infrastructure.store", "application.runs", "api.schemas", "bootstrap"):
            with self.subTest(target=target):
                self.assertTrue(self.check(
                    "ai-service/src/ai_service/workflows/bad.py",
                    f"import ai_service.{target}",
                ))
        self.assertFalse(self.check(
            "ai-service/src/ai_service/workflows/good.py",
            "from langgraph.graph import StateGraph\nfrom ai_service.agent_core import ports",
        ))

    def test_infrastructure_implements_ports_without_workflow_dependencies(self):
        self.assertTrue(self.check(
            "ai-service/src/ai_service/infrastructure/bad.py",
            "from ai_service.workflows import echo",
        ))
        self.assertFalse(self.check(
            "ai-service/src/ai_service/infrastructure/good.py",
            "from ai_service.config import Settings\nfrom ai_service.agent_core import ports",
        ))

    def test_composition_root_exception_is_local_to_api_factory(self):
        store_import = "from ai_service.infrastructure.store import Store"
        self.assertFalse(self.check("ai-service/src/ai_service/api/app.py", store_import))
        self.assertTrue(self.check("ai-service/src/ai_service/api/routes.py", store_import))
        self.assertTrue(self.check(
            "ai-service/src/ai_service/api/app.py",
            "from ai_service.workflows.echo import execute_echo",
        ))
        self.assertFalse(self.check(
            "ai-service/src/ai_service/worker.py",
            store_import + "\nfrom ai_service.workflows.echo import execute_echo",
        ))
        self.assertFalse(self.check(
            "ai-service/src/ai_service/bootstrap.py",
            "from ai_service.agent_core.runtime import WorkflowRunner",
        ))

    def test_cross_service_imports_include_entrypoints_and_package_aliases(self):
        self.assertTrue(self.check("backend/main.py", "import ai_service"))
        for content in ("import app.core", "import backend.app", "from backend import app"):
            with self.subTest(content=content):
                self.assertTrue(self.check("ai-service/src/ai_service/worker.py", content))

    def test_nested_relative_imports_follow_the_same_boundaries(self):
        self.assertTrue(self.check(
            "ai-service/src/ai_service/agent_core/nested/bad.py",
            "from ...bootstrap import create_runner",
        ))
        self.assertFalse(self.check(
            "ai-service/src/ai_service/application/nested/good.py",
            "from ...agent_core.ports import RunStore",
        ))

    def test_syntax_errors_produce_file_and_line_diagnostics(self):
        errors = self.check("backend/main.py", "def broken(:\n")
        self.assertEqual(len(errors), 1)
        self.assertIn("backend/main.py:1: invalid Python syntax", errors[0])
