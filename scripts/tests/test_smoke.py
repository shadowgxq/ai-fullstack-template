import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("smoke", Path(__file__).parents[1] / "smoke.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SmokeChecks(unittest.TestCase):
    def test_web_only_never_contacts_ai(self):
        def request(base, path, **kwargs):
            self.assertNotIn(":8001", base)
            if path == "/":
                return '<div id="root"><script src="/assets/test.js"></script>'
            if path == "/health": return {"status": "ok"}
            if path == "/ready": return {"status": "ready"}
            if path.endswith("register"):
                self.username = kwargs["payload"]["username"]
            if path.endswith("login"):
                return {"data": {"access_token": "test"}}
            if path.endswith("me"):
                return {"data": {"username": self.username}}
            return {}
        with patch.object(module, "request", side_effect=request), patch("sys.argv", ["smoke.py", "--skip-ai"]):
            module.main()

    def test_non_loopback_target_rejected_before_writes(self):
        with patch.object(module, "request") as request, patch("sys.argv", ["smoke.py", "--backend", "https://production.example"]):
            with self.assertRaises(ValueError): module.main()
            request.assert_not_called()
