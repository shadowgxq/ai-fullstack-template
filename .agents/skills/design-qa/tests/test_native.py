"""Native collector fixtures; no real iOS/Android application is launched."""
import importlib.util
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import zlib

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('native_evidence',ROOT/'design-qa/scripts/native_evidence.py')
native = importlib.util.module_from_spec(spec); spec.loader.exec_module(native)


def png():
    def chunk(name, data): return struct.pack('>I',len(data))+name+data+struct.pack('>I',zlib.crc32(name+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\x00\x00\x00'))+chunk(b'IEND',b'')


class NativeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup); self.root = Path(self.tmp.name)
        self.spec = {'platform':'android','target':'fixture-home','snapshot':'fixture-snapshot','build':'fixture-build','state':'default',
                     'source':'fixture-not-a-device','evidenceLevel':'fixture','viewport':{'width':1,'height':1},'scale':1,
                     'captureCommand':[sys.executable,'-c','from pathlib import Path;import sys;Path(sys.argv[1]).write_bytes(bytes.fromhex(sys.argv[2]))','{screenshot}',png().hex()]}

    def test_capture_creates_fresh_png_but_not_visual_or_behavior_pass(self):
        result = native.collect(self.spec,self.root/'run')
        self.assertTrue(result['ok']); self.assertEqual(result['image']['width'],1)
        self.assertEqual(result['visual_checks'],'not_run'); self.assertEqual(result['runtime_checks'],'not_run')
        self.assertIn('fixture runner is not an iOS/Android app test',result['gaps'])

    def test_runner_failure_is_not_success(self):
        self.spec['testCommand'] = [sys.executable,'-c','raise SystemExit(1)']
        result = native.collect(self.spec,self.root/'run')
        self.assertFalse(result['ok']); self.assertEqual(result['runtime_checks'],'failed')

    def test_exit_zero_without_screenshot_rejected(self):
        self.spec['captureCommand'] = [sys.executable,'-c','pass']
        self.assertFalse(native.collect(self.spec,self.root/'run')['ok'])

    def test_web_platform_rejected(self):
        self.spec['platform'] = 'web'
        with self.assertRaises(ValueError): native.collect(self.spec,self.root/'run')

    def test_existing_output_not_overwritten(self):
        native.collect(self.spec,self.root/'run')
        with self.assertRaises(FileExistsError): native.collect(self.spec,self.root/'run')

    def test_import_is_limited_evidence(self):
        file = self.root/'source.png'; file.write_bytes(png()); del self.spec['captureCommand']; self.spec['importScreenshot'] = str(file)
        result = native.collect(self.spec,self.root/'run')
        self.assertEqual(result['capture'],'imported'); self.assertEqual(result['runtime_checks'],'not_run')
        self.spec['testCommand'] = [sys.executable,'-c','pass']
        with self.assertRaises(ValueError): native.collect(self.spec,self.root/'bad')

    def test_unknown_or_mismatched_scale_not_pixel_pass(self):
        del self.spec['scale']; result = native.collect(self.spec,self.root/'unknown')
        self.assertTrue(any('qualitative' in gap for gap in result['gaps']))
        self.spec['scale'] = 2; result = native.collect(self.spec,self.root/'mismatch')
        self.assertTrue(any('dimensions differ' in gap for gap in result['gaps']))
        self.assertEqual(result['visual_checks'],'not_run')

    def test_truncated_png_import_and_runner_rejected(self):
        # The old implementation treated just the PNG header + IHDR as valid.
        truncated = png()[:33]
        file = self.root/'header-only.png'; file.write_bytes(truncated)
        with self.assertRaises(ValueError):
            native.png_size(file)
        del self.spec['captureCommand']
        self.spec['importScreenshot'] = str(file)
        result = native.collect(self.spec, self.root/'import')
        self.assertFalse(result['ok'])
        self.assertEqual(result['capture'], 'failed')
        self.assertNotIn('image', result)
        del self.spec['importScreenshot']
        self.spec['captureCommand'] = [sys.executable, '-c',
                                       'from pathlib import Path;import sys;Path(sys.argv[1]).write_bytes(bytes.fromhex(sys.argv[2]))',
                                       '{screenshot}', truncated.hex()]
        runner = native.collect(self.spec, self.root/'runner')
        self.assertFalse(runner['ok'])
        self.assertEqual(runner['capture'], 'failed')

    def test_png_missing_iend_bad_crc_corrupt_compression_and_trailing_data(self):
        valid = png()
        cases = {
            'no-iend': valid[:-12],
            'bad-crc': valid[:32] + bytes([valid[32] ^ 0xff]) + valid[33:],
            'bad-compression': valid.replace(zlib.compress(b'\x00\x00\x00\x00'),
                                              b'\x00' * len(zlib.compress(b'\x00\x00\x00\x00'))),
            'trailing': valid + b'invalid',
        }
        for name, data in cases.items():
            with self.subTest(name=name):
                file = self.root/(name+'.png'); file.write_bytes(data)
                with self.assertRaises(ValueError):
                    native.png_size(file)

    def test_invalid_png_rejected(self):
        file = self.root/'bad.png'; file.write_bytes(b'not an image')
        with self.assertRaises(ValueError): native.png_size(file)


if __name__ == '__main__': unittest.main()
