"""Partial same-role data must not masquerade as a complete design page."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('slice_cache',ROOT/'design-to-code/scripts/cache.py')
cache = importlib.util.module_from_spec(spec); spec.loader.exec_module(cache)


class SliceCompleteness(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.incoming = self.root/'incoming'; self.incoming.mkdir()
        (self.incoming/'header.json').write_text('{"id":"header"}')
        self.spec = {'source':{'provider':'pencil','origin':'saved-file','document':'fixture.pen','nodes':['home']},
                     'request':{},'observation':{'method':'read','task':'fixture'},
                     'artifacts':[{'role':'structure','status':'available','path':'header.json','required':True}]}

    def publish(self):
        return Path(cache.publish(self.root/'cache',self.spec,self.incoming)['path'])

    def test_missing_required_slice_not_hidden_by_available_sibling(self):
        self.spec['artifacts'].append({'role':'structure','status':'missing','required':True,'details':{'node':'footer'}})
        result = cache.assess(self.publish(),task='fixture')
        self.assertFalse(result['reuse']); self.assertEqual(result['gaps'],['structure'])
        self.assertEqual(result['incompleteArtifacts'][0]['details']['node'],'footer')

    def test_caller_required_role_requires_all_declared_slices(self):
        self.spec['artifacts'].append({'role':'structure','status':'denied','details':{'node':'footer'}})
        snapshot = self.publish()
        self.assertFalse(cache.assess(snapshot,required=['structure'],intent='offline')['reuse'])

    def test_optional_unrequested_capability_is_not_global_blocker(self):
        self.spec['artifacts'].append({'role':'variables','status':'unsupported'})
        self.assertTrue(cache.assess(self.publish(),task='fixture')['reuse'])

    def test_non_boolean_required_flag_is_rejected(self):
        for value in ('false',1,[],None):
            self.spec['artifacts'][0]['required'] = value
            with self.subTest(value=value), self.assertRaises(ValueError): self.publish()

    def test_malformed_manifest_shapes_fail_closed(self):
        snapshot = self.publish()
        for value in ([],None,{'artifacts':None}):
            (snapshot/'manifest.json').write_text(json.dumps(value))
            self.assertFalse(cache.assess(snapshot,intent='offline')['reuse'])

    def test_two_ready_slices_are_accepted(self):
        (self.incoming/'footer.json').write_text('{"id":"footer"}')
        self.spec['artifacts'].append({'role':'structure','status':'available','path':'footer.json','required':True})
        self.assertTrue(cache.assess(self.publish(),required=['structure'],task='fixture')['reuse'])


if __name__ == '__main__': unittest.main()
