from pathlib import Path
import hashlib
import json
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).parents[1]))
from check_sources import manager_errors
from check_docs import hygiene_errors

class SourceIntegrityTests(unittest.TestCase):
    def test_pinned_source_cannot_be_silently_modified(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); path=root/'.agents/skills/manager-run/SKILL.md'
            path.parent.mkdir(parents=True); path.write_text('Read docs/prd/example.md')
            manifest=root/'scripts/manager/upstream.json';manifest.parent.mkdir(parents=True)
            manifest.write_text(json.dumps({'files':[{'path':str(path.relative_to(root)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}]}))
            self.assertEqual(manager_errors(root), [])
            self.assertEqual(hygiene_errors(root), [])
            path.write_text('tampered')
            self.assertTrue(manager_errors(root))
    def test_root_roles_allowed_but_duplicate_end_configuration_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); (root/'manager').mkdir();(root/'manager/roles.yaml').write_text('version: 2')
            self.assertEqual(hygiene_errors(root), [])
            (root/'frontend/.codex').mkdir(parents=True)
            self.assertTrue(hygiene_errors(root))
