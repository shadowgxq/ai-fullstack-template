from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).parents[1]))
from check_docs import hygiene_errors

class SourceIntegrityTests(unittest.TestCase):
    def test_root_roles_allowed_but_duplicate_end_configuration_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'manager').mkdir();(root/'manager/roles.yaml').write_text('version: 2')
            self.assertEqual(hygiene_errors(root), [])
            (root/'frontend/.codex').mkdir(parents=True)
            self.assertTrue(hygiene_errors(root))
