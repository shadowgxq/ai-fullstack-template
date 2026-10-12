"""Deterministic cache regression, not live provider or LLM fidelity evaluation."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


cache = load('evidence_cache', ROOT / 'design-to-code/scripts/cache.py')


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name); self.incoming = self.root / 'incoming'; self.incoming.mkdir()
        (self.incoming / 'raw').mkdir()
        (self.incoming / 'raw/structure.json').write_text('{"id":"home"}')
        (self.incoming / 'raw/styles.json').write_text('{"color":"#123456"}')
        self.spec = {'source': {'provider':'pencil','document':'design/home.pen','nodes':['home'],'origin':'saved-file'},
                     'request': {'adapterVersion':1,'framework':'react','theme':'light'},
                     'observation': {'method':'revision','before':'v1','after':'v1','coversDependencies':True},
                     'artifacts': [{'role':'structure','status':'available','path':'raw/structure.json','required':True},
                                   {'role':'styles','status':'available','path':'raw/styles.json','required':True},
                                   {'role':'assets','status':'empty'}]}

    def publish(self, spec=None):
        return Path(cache.publish(self.root / '.design-cache', spec or self.spec, self.incoming)['path'])

    def test_route_templates_normalize_before_hash(self):
        self.assertEqual(cache.canonical_page('/orders/[id]'), cache.canonical_page('/orders/:id'))
        self.assertNotEqual(cache.canonical_page('/orders/[...id]'), cache.canonical_page('/orders/:id'))

    def test_unicode_state_does_not_collapse_to_slug(self):
        def state_key(name):
            target = cache.target_identity({'project':'app','page':'/home','platform':'web','state':name})
            return cache.key(target['state'], target)
        values = [state_key(n) for n in ('加载中','空状态','default','a b','a-b')]
        self.assertEqual(len(values), len(set(values)))
        self.assertEqual(state_key('e\u0301'), state_key('é'))

    def test_file_paths_are_not_routes(self):
        self.assertNotEqual(cache.canonical_page('app/[id].vue','file'), cache.canonical_page('app/:id.vue','file'))
        self.assertNotEqual(cache.canonical_page('Home.vue','file'), cache.canonical_page('home.vue','file'))
        self.assertNotEqual(cache.canonical_page('/home','route'), cache.canonical_page('/home','file'))

    def test_url_preserves_state_and_origin(self):
        self.assertNotEqual(cache.canonical_page('https://a.test/home?tab=a','url'), cache.canonical_page('https://a.test/home?tab=b','url'))
        self.assertNotEqual(cache.canonical_page('https://a.test/home','url'), cache.canonical_page('https://b.test/home','url'))
        self.assertNotEqual(cache.canonical_page('https://a.test/#one','url'), cache.canonical_page('https://a.test/#two','url'))

    def test_source_nodes_canonical_and_origin_isolated(self):
        a = deepcopy(self.spec['source']); a['nodes'] = ['b','a','a']
        b = deepcopy(a); b['nodes'] = ['a','b']
        self.assertEqual(cache.source_identity(a), cache.source_identity(b))
        b['origin'] = 'editor'; self.assertNotEqual(cache.source_identity(a), cache.source_identity(b))

    def test_target_package_platform_state_isolation(self):
        base = {'project':'mono','package':'web','page':'/home','platform':'web','state':'default'}
        targets = [base, {**base,'package':'admin'}, {**base,'platform':'ios'}, {**base,'platform':'android'}, {**base,'state':'空状态'}]
        keys = [cache.key('target', cache.target_identity(t)) for t in targets]
        self.assertEqual(len(keys),len(set(keys)))

    def test_valid_figma_identity(self):
        a = cache.parse_figma_url('https://www.figma.com/design/AbC/name?node-id=12-34')
        b = cache.parse_figma_url('https://figma.com/design/AbC/name?node-id=12%3A34')
        self.assertEqual(a,b)
        self.assertEqual(cache.parse_figma_url('https://figma.com/design/AbC/branch/Def/name?node-id=12-34')['branch'],'Def')

    def test_invalid_figma_urls_fail_closed(self):
        for url in ('https://evil.test/design/AbC?node-id=12-34','https://figma.com/design/AbC','https://figma.com/design/AbC?node-id=x',
                    'https://figma.com/design/AbC?node-id=1-2&node-id=3-4','https://user:secret@figma.com/design/AbC?node-id=1-2'):
            with self.subTest(url=url), self.assertRaises(ValueError): cache.parse_figma_url(url)

    def test_publish_and_integrity(self):
        snapshot = self.publish(); self.assertEqual(cache.validate(snapshot), [])
        self.assertTrue((self.root / '.design-cache/.gitignore').is_file())
        self.assertFalse(any(p.name.startswith('.pending-') for p in snapshot.parent.iterdir()))
        self.assertEqual(snapshot, self.publish())

    def test_no_revision_no_freshness_claim(self):
        snapshot = self.publish()
        self.assertFalse(cache.assess(snapshot)['reuse'])
        self.assertEqual(cache.assess(snapshot)['reason'],'reread-required')
        self.assertTrue(cache.assess(snapshot, revision='v1')['reuse'])
        self.assertFalse(cache.assess(snapshot, revision='v2')['reuse'])

    def test_revision_change_creates_new_snapshot(self):
        one = self.publish(); spec = deepcopy(self.spec); spec['observation'].update(before='v2',after='v2')
        two = self.publish(spec); self.assertNotEqual(one,two); self.assertTrue(one.exists())

    def test_unknown_dependency_revision_requires_reread(self):
        spec = deepcopy(self.spec); spec['observation']['coversDependencies'] = False
        self.assertFalse(cache.assess(self.publish(spec), revision='v1')['reuse'])

    def test_pinned_read_is_only_within_same_task(self):
        spec = deepcopy(self.spec); spec['observation'] = {'method':'read','task':'current','dirty':True}
        snapshot = self.publish(spec)
        self.assertTrue(cache.assess(snapshot, task='current')['reuse'])
        self.assertFalse(cache.assess(snapshot, task='next')['reuse'])
        self.assertFalse(cache.assess(snapshot, intent='refresh', task='current')['reuse'])

    def test_offline_explicitly_unknown(self):
        result = cache.assess(self.publish(), intent='offline')
        self.assertTrue(result['reuse']); self.assertEqual(result['freshness'],'unknown')

    def test_request_framework_theme_or_scale_isolated(self):
        one = self.publish()
        for property, value in (('framework','vue'),('theme','dark'),('scale',2)):
            spec = deepcopy(self.spec); spec['request'][property] = value
            with self.subTest(property=property):
                self.assertNotEqual(one,self.publish(spec))
                self.assertFalse(cache.assess(one,request=spec['request'],revision='v1')['reuse'])

    def test_changed_during_fetch_not_published(self):
        spec = deepcopy(self.spec); spec['observation']['after'] = 'v2'
        with self.assertRaises(ValueError): self.publish(spec)
        self.assertFalse(list((self.root / '.design-cache').glob('snapshots/*/snapshot-*')))

    def test_distinct_gap_statuses_and_required_baseline(self):
        spec = deepcopy(self.spec); spec['artifacts'] += [{'role':s,'status':s} for s in ('unsupported','denied','error','missing')]
        snapshot = self.publish(spec)
        self.assertEqual({e['status'] for e in cache.load_snapshot(snapshot)['artifacts']}, cache.STATUSES)
        self.assertEqual(cache.assess(snapshot,required=['baseline'],revision='v1')['reason'],'missing-evidence')

    def test_required_unsupported_does_not_pass(self):
        spec = deepcopy(self.spec); spec['artifacts'].append({'role':'baseline','status':'unsupported','required':True})
        self.assertFalse(cache.assess(self.publish(spec),intent='offline')['reuse'])

    def test_structure_cannot_be_empty_success(self):
        spec = deepcopy(self.spec); spec['artifacts'][0] = {'role':'structure','status':'empty'}
        with self.assertRaises(ValueError): self.publish(spec)

    def test_invalid_paths_and_executable_extensions(self):
        for name in ('../outside.txt','/tmp/out.txt','raw/../out.txt','C:\\file.txt','raw/component.tsx','manifest.json'):
            spec = deepcopy(self.spec); spec['artifacts'][0]['path'] = name
            with self.subTest(name=name), self.assertRaises(ValueError): self.publish(spec)

    def test_reserved_manifest_aliases_do_not_publish(self):
        for name in ('MANIFEST.JSON', 'Manifest.Json', 'manifest.json.', 'manifest.json ', 'CON.txt'):
            spec = deepcopy(self.spec)
            spec['artifacts'][0]['path'] = name
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.publish(spec)
        # A failed publication must not expose an immutable, broken snapshot.
        self.assertEqual(list((self.root/'.design-cache').glob('snapshots/*/snapshot-*')), [])

    def test_casefold_duplicate_artifact_names_rejected(self):
        spec = deepcopy(self.spec)
        spec['artifacts'][1]['path'] = 'RAW/STRUCTURE.JSON'
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            self.publish(spec)
        spec['artifacts'][1]['path'] = 'raw//styles.json'
        with self.assertRaises(ValueError):
            self.publish(spec)
        spec['artifacts'][1]['path'] = 'raw/styles.json.'
        with self.assertRaises(ValueError):
            self.publish(spec)

    def test_validation_rejects_casefold_alias_in_existing_snapshot(self):
        snapshot = self.publish()
        manifest = cache.load_snapshot(snapshot)
        # Case differences remain invalid even on a case-sensitive CI runner.
        manifest['artifacts'].append({**manifest['artifacts'][0], 'path': 'RAW/STRUCTURE.JSON'})
        (snapshot/'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
        self.assertIn('duplicate artifact path alias', cache.validate(snapshot))

    def test_symlink_and_duplicate_artifact_rejected(self):
        (self.incoming / 'raw/link.json').symlink_to(self.incoming / 'raw/styles.json')
        spec = deepcopy(self.spec); spec['artifacts'][0]['path'] = 'raw/link.json'
        with self.assertRaises(ValueError): self.publish(spec)
        spec = deepcopy(self.spec); spec['artifacts'].append(deepcopy(spec['artifacts'][0]))
        with self.assertRaises(ValueError): self.publish(spec)

    def test_corrupt_and_missing_files_detected_even_offline(self):
        snapshot = self.publish(); (snapshot/'raw/styles.json').write_text('changed')
        self.assertFalse(cache.assess(snapshot,intent='offline')['reuse'])
        (snapshot/'raw/styles.json').unlink(); self.assertTrue(cache.validate(snapshot))
        with self.assertRaises(ValueError): self.publish()

    def test_manifest_tampering_detected(self):
        snapshot = self.publish(); m = cache.load_snapshot(snapshot); m['request']['framework'] = 'native'
        (snapshot/'manifest.json').write_text(json.dumps(m))
        self.assertIn('snapshot identity mismatch',cache.validate(snapshot))

    def test_exclusive_lock_and_cleanup(self):
        with cache.lock(self.root/'locks','target'):
            with self.assertRaises(FileExistsError):
                with cache.lock(self.root/'locks','target'): pass
        with cache.lock(self.root/'locks','target'): pass
        self.assertEqual(list((self.root/'locks').iterdir()),[])

    def test_target_context_invalidation_does_not_refetch_source(self):
        snapshot = self.publish(); (self.root/'tokens.txt').write_text('primary=blue')
        target = {'project':'app','page':'/home','platform':'web'}
        first = cache.bind_target(self.root/'.design-cache',target,snapshot,self.root,['tokens.txt'])
        (self.root/'tokens.txt').write_text('primary=red')
        second = cache.bind_target(self.root/'.design-cache',target,snapshot,self.root,['tokens.txt'])
        self.assertNotEqual(first['contextHash'],second['contextHash'])
        self.assertEqual(first['snapshotKey'],second['snapshotKey'])
        self.assertTrue(cache.assess(snapshot,revision='v1')['reuse'])

    def test_local_assets_do_not_expire_with_remote_urls(self):
        (self.incoming/'asset.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        spec = deepcopy(self.spec); spec['artifacts'][-1] = {'role':'assets','status':'available','path':'asset.svg','details':{'urlExpired':True}}
        self.assertTrue(cache.assess(self.publish(spec),revision='v1',required=['assets'])['reuse'])

    def test_credentials_rejected_in_metadata(self):
        spec = deepcopy(self.spec); spec['request']['authorization'] = 'secret'
        with self.assertRaises(ValueError): self.publish(spec)

    def test_unknown_observation_methods_rejected_before_publish(self):
        for observation in ({}, {'method':'legacy'}, {'method':'other'}, {'method':[]}):
            spec = deepcopy(self.spec); spec['observation'] = observation
            with self.subTest(observation=observation), self.assertRaises(ValueError):
                self.publish(spec)
        self.assertFalse(list((self.root/'.design-cache').glob('snapshots/*/snapshot-*')))

    def test_invalid_observation_cannot_be_reused_even_offline(self):
        for observation in ({'method':'legacy','task':'current'}, {'method':'unknown','task':'current'},
                            {'method':'revision','before':'v1','after':'v2'},
                            {'method':'revision','task':'current'}):
            with self.subTest(observation=observation):
                snapshot = self.publish()
                manifest = cache.load_snapshot(snapshot)
                manifest['observation'] = observation
                # Recompute identities to isolate validation of the observation itself.
                manifest['snapshotKey'] = cache.key('snapshot', cache.identity_payload(manifest))
                changed = snapshot.parent/manifest['snapshotKey']
                snapshot.rename(changed)
                (changed/'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
                for intent in ('auto', 'offline'):
                    result = cache.assess(changed, intent=intent, task='current', revision='v2')
                    self.assertFalse(result['reuse'])
                    self.assertEqual(result['reason'], 'invalid')

    def test_cli_has_only_current_commands_and_does_not_migrate(self):
        folder = self.root/'source'; folder.mkdir()
        original = folder/'figma.source.json'; original.write_text('{"stateName":"加载中"}', encoding='utf-8')
        before = original.read_bytes()
        command = [sys.executable, str(ROOT/'design-to-code/scripts/cache.py')]
        help_result = subprocess.run(command+['--help'], capture_output=True, text=True)
        self.assertEqual(help_result.returncode, 0)
        self.assertIn('{keys,publish,check,bind}', help_result.stdout)
        removed = subprocess.run(command+['legacy', str(folder)], capture_output=True, text=True)
        self.assertNotEqual(removed.returncode, 0)
        self.assertEqual(before, original.read_bytes())
        self.assertEqual(list(folder.iterdir()), [original])

    def test_two_sources_three_frameworks_keep_request_evidence_separate(self):
        snapshots = set()
        for provider in ('figma','pencil'):
            for framework in ('react','vue','react-native'):
                spec = deepcopy(self.spec); spec['source'].update(provider=provider,origin='remote' if provider=='figma' else 'saved-file')
                spec['request']['framework'] = framework
                snapshots.add(str(self.publish(spec)))
        self.assertEqual(len(snapshots),6)


if __name__ == '__main__': unittest.main()
