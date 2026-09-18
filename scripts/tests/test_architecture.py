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
