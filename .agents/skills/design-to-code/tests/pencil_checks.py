"""Run last: official-format-derived data and self-authored MCP fixtures, not live host."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FIX = Path(__file__).parent/'fixtures'

def load(name, file):
    spec = importlib.util.spec_from_file_location(name,file); module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

source = load('pencil_source',ROOT/'design-to-code/scripts/pencil_source.py')
mcp = load('mcp_probe',ROOT/'design-to-code/scripts/mcp_probe.py')


class PencilChecks(unittest.TestCase):
    def test_official_format_derived_fixture_read_without_mutation(self):
        file = FIX/'home.pen'; before = file.read_bytes(); result = source.read_saved(file,'home')
        self.assertEqual(result['node']['width'],390); self.assertEqual(result['node']['height'],844)
        self.assertIn('home-action',result['selectedIds']); self.assertEqual(result['referencedComponents'],['primary-button'])
        self.assertEqual(result['unresolvedReferences'],[])
        self.assertEqual(result['fileHash'],hashlib.sha256(before).hexdigest()); self.assertEqual(before,file.read_bytes())
        self.assertEqual(result['live_mcp'],'not_run'); self.assertEqual(result['visual_checks'],'not_run')

    def test_json_comments_preserve_strings(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)/'comments.pen'
            p.write_text('{"version":"fixture",/* comment */"children":[{"id":"one","type":"text","content":"https://example.test/*keep*/"}]}')
            self.assertEqual(source.read_saved(p,'one')['node']['content'],'https://example.test/*keep*/')

    def test_saved_reader_rejects_missing_and_duplicate_nodes(self):
        with self.assertRaises(ValueError): source.read_saved(FIX/'home.pen','absent')
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)/'bad.pen'; p.write_text('{"version":"fixture","children":[{"id":"x","type":"frame"},{"id":"x","type":"frame"}]}')
            with self.assertRaises(ValueError): source.read_saved(p,'x')

    def test_script_nodes_are_data_never_executed(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)/'script.pen'; p.write_text(json.dumps({'version':'fixture','children':[{'id':'x','type':'script','code':'throw new Error("must not execute")'}]}))
            result = source.read_saved(p,'x'); self.assertEqual(result['scriptNodesNotExecuted'],['x'])

    def probe(self, mode='ok', **kwargs):
        return mcp.probe([sys.executable,str(FIX/'mock_mcp.py'),'--mode',mode],fixture=True,**kwargs)

    def test_mock_roundtrip_and_no_execute_calls(self):
        with tempfile.TemporaryDirectory() as td:
            log = Path(td)/'calls.jsonl'
            result = mcp.probe([sys.executable,str(FIX/'mock_mcp.py'),'--log',str(log)],fixture=True)
            calls = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertEqual(result['evidenceLevel'],'fixture'); self.assertEqual(result['state_read'],'passed')
            self.assertEqual(result['design_read'],'not_run'); self.assertFalse(result['writesPerformed'])
            self.assertFalse(any(c.get('tool') == 'execute' for c in calls))
            self.assertEqual([c['method'] for c in calls][:3],['initialize','notifications/initialized','tools/list'])

    def test_pagination_discovery(self):
        self.assertEqual(self.probe('pagination')['state_read'],'passed')

    def test_no_known_read_tool_does_not_fallback_to_execute(self):
        self.assertEqual(self.probe('no-state')['state_read'],'not_run')

    def test_discovered_schema_controls_arguments(self):
        self.assertEqual(self.probe('required')['state_read'],'not_run')
        self.assertEqual(self.probe('required',arguments={'document':'fixture/home.pen'})['state_read'],'passed')
        self.assertEqual(self.probe(arguments={'unexpected':True})['state_read'],'not_run')

    def test_empty_error_timeout_and_cursor_loop(self):
        self.assertEqual(self.probe('empty')['state_read'],'not_run')
        for mode in ('error','cursor-loop'):
            with self.subTest(mode=mode), self.assertRaises(ValueError): self.probe(mode)
        with self.assertRaises(TimeoutError): self.probe('timeout',timeout=0.1)

    def test_utf8_and_bom_chinese_parameters_are_read_independent_of_locale(self):
        with tempfile.TemporaryDirectory() as directory:
            for encoding in ('utf-8', 'utf-8-sig'):
                with self.subTest(encoding=encoding):
                    arguments = Path(directory)/('args-'+encoding+'.json')
                    arguments.write_text(json.dumps({'document':'设计/首页.pen'},ensure_ascii=False),encoding=encoding)
                    proc = subprocess.run(
                        [sys.executable, str(ROOT/'design-to-code/scripts/mcp_probe.py'),
                         '--args-file', str(arguments), '--fixture', '--',
                         sys.executable, str(FIX/'mock_mcp.py'), '--mode', 'required'],
                        capture_output=True, text=True, encoding='utf-8')
                    self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
                    result = json.loads(proc.stdout)
                    self.assertEqual(result['state_read'], 'passed')
                    self.assertEqual(result['stateTool'], 'get_app_state')

    def test_no_live_command_is_honest_not_run(self):
        result = subprocess.run([sys.executable,str(ROOT/'design-to-code/scripts/mcp_probe.py')],capture_output=True,text=True)
        self.assertEqual(result.returncode,2); self.assertEqual(json.loads(result.stdout)['live_mcp'],'not_run')


if __name__ == '__main__': unittest.main()
