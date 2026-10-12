#!/usr/bin/env python3
"""Collect caller-authorized native runner evidence; never claim visual comparison."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import zlib


def png_size(file):
    """Verify a *decodable* PNG, not merely its 33-byte IHDR header.

    Parse chunk bounds and CRCs, require IDAT/IEND, and validate the bounded
    zlib image stream (including scanline filters and Adam7 pass lengths).
    No dependency on Pillow or other optional packages in the native runner.
    """
    data = Path(file).read_bytes()
    if len(data) > 128 * 1024 * 1024 or data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('invalid PNG screenshot')
    offset, width, height, depth, channels, interlace = 8, None, None, None, None, None
    seen_ihdr = seen_idat = seen_iend = idat_ended = seen_palette = False
    compressed = bytearray()
    color_depths = {0: (1, 2, 4, 8, 16), 2: (8, 16), 3: (1, 2, 4, 8),
                    4: (8, 16), 6: (8, 16)}
    color_channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}

    while offset < len(data):
        if len(data) - offset < 12:
            raise ValueError('truncated PNG chunk')
        length = struct.unpack_from('>I', data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError('truncated PNG chunk payload')
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:end - 4]
        crc = struct.unpack_from('>I', data, end - 4)[0]
        if (zlib.crc32(kind + payload) & 0xffffffff) != crc:
            raise ValueError('invalid PNG chunk CRC')
        if not seen_ihdr and kind != b'IHDR':
            raise ValueError('PNG IHDR must be first')
        if kind == b'IHDR':
            if seen_ihdr or length != 13:
                raise ValueError('invalid PNG IHDR')
            width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', payload)
            if (not width or not height or width > 32768 or height > 32768 or
                color not in color_depths or depth not in color_depths[color] or
                compression != 0 or filtering != 0 or interlace not in (0, 1)):
                raise ValueError('invalid PNG image parameters')
            channels = color_channels[color]
            seen_ihdr = True
        elif kind == b'PLTE':
            if seen_idat or seen_palette or length == 0 or length % 3 or length > 768:
                raise ValueError('invalid PNG palette')
            seen_palette = True
        elif kind == b'IDAT':
            if idat_ended or (color == 3 and not seen_palette):
                raise ValueError('PNG IDAT misplaced or palette missing')
            seen_idat = True
            compressed.extend(payload)
        elif kind == b'IEND':
            if not seen_idat or seen_iend or length != 0 or end != len(data):
                raise ValueError('invalid PNG IEND')
            seen_iend = True
        elif seen_idat:
            idat_ended = True
        offset = end
    if not seen_ihdr or not seen_idat or not seen_iend or not compressed:
        raise ValueError('PNG missing image data or IEND')

    passes = [(width, height)] if interlace == 0 else []
    if interlace == 1:
        for x, y, step_x, step_y in ((0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8),
                                     (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2),
                                     (0, 1, 1, 2)):
            pw = max(0, (width - x + step_x - 1) // step_x)
            ph = max(0, (height - y + step_y - 1) // step_y)
            if pw and ph:
                passes.append((pw, ph))

    expected_size = sum((((pw * channels * depth + 7) // 8) + 1) * ph for pw, ph in passes)
    if expected_size > 512 * 1024 * 1024:
        raise ValueError('PNG decompression size limit exceeded')
    try:
        decoder = zlib.decompressobj()
        pixels = decoder.decompress(bytes(compressed), expected_size + 1)
        if (len(pixels) != expected_size or not decoder.eof or
            decoder.unused_data or decoder.unconsumed_tail):
            raise ValueError('incomplete PNG image stream')
    except zlib.error as exc:
        raise ValueError('invalid PNG compressed image data') from exc
    position = 0
    for pw, ph in passes:
        row_length = ((pw * channels * depth + 7) // 8) + 1
        for _ in range(ph):
            if pixels[position] not in (0, 1, 2, 3, 4):
                raise ValueError('invalid PNG scanline filter')
            position += row_length
    return {'width': width, 'height': height, 'sha256': hashlib.sha256(data).hexdigest()}

def run_command(argv, replacements, timeout):
    if not isinstance(argv, list) or not argv or not all(isinstance(a, str) and a for a in argv):
        raise ValueError('command must be a nonempty explicit argv array')
    command = [a.replace('{screenshot}', replacements['screenshot']).replace('{output}', replacements['output']) for a in argv]
    # No shell. Never print argv or runner logs: they may contain credentials.
    try:
        done = subprocess.run(command, shell=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout)
        return {'exitCode': done.returncode, 'timedOut': False}
    except subprocess.TimeoutExpired:
        return {'exitCode': None, 'timedOut': True}


def collect(spec, out):
    if spec.get('platform') not in ('ios', 'android'):
        raise ValueError('native evidence requires ios or android, never web')
    for field in ('target', 'snapshot', 'build', 'state', 'source'):
        if not isinstance(spec.get(field), str) or not spec[field].strip():
            raise ValueError('missing provenance: ' + field)
    if ('captureCommand' in spec) == ('importScreenshot' in spec):
        raise ValueError('provide exactly one captureCommand or importScreenshot')
    if 'importScreenshot' in spec and 'testCommand' in spec:
        raise ValueError('imported screenshots cannot be coupled to a newly run behavior test')
    output = Path(out).resolve()
    output.mkdir(parents=True, exist_ok=False)
    shot = output / 'capture.png'
    report = {k: spec[k] for k in ('platform', 'target', 'snapshot', 'build', 'state', 'source')}
    report.update(capturedAt=datetime.now(timezone.utc).isoformat(), code_checks='not_run', runtime_checks='not_run',
                  visual_checks='not_run', evidenceLevel=spec.get('evidenceLevel', 'caller-runner'), gaps=['visual comparison not performed'])
    replacements = {'screenshot': str(shot), 'output': str(output)}
    timeout = spec.get('timeout', 120)
    if not isinstance(timeout, (float, int)) or isinstance(timeout, bool) or not 0 < timeout <= 1800:
        raise ValueError('invalid timeout')
    try:
        if 'importScreenshot' in spec:
            src = Path(spec['importScreenshot'])
            if src.is_symlink():
                raise ValueError('import screenshot must not be a symlink')
            png_size(src)
            shutil.copyfile(src, shot)
            report['capture'] = 'imported'; report['gaps'].append('imported image does not prove behavior or capture time')
        else:
            if 'testCommand' in spec:
                outcome = run_command(spec['testCommand'], replacements, timeout)
                report['testRunner'] = outcome
                report['runtime_checks'] = 'passed' if outcome['exitCode'] == 0 else 'failed'
            outcome = run_command(spec['captureCommand'], replacements, timeout)
            report['captureRunner'] = outcome
            if outcome['exitCode'] != 0 or not shot.is_file() or shot.is_symlink():
                raise ValueError('capture runner failed or did not create a fresh screenshot')
            report['capture'] = 'runner'
        image = png_size(shot); report['image'] = image
        view, scale = spec.get('viewport'), spec.get('scale')
        positive = lambda n: isinstance(n, (int, float)) and not isinstance(n, bool) and math.isfinite(n) and n > 0
        if isinstance(view, dict) and all(positive(view.get(k)) for k in ('width','height')) and positive(scale):
            report.update(viewport=view, scale=scale, contentRect=spec.get('contentRect'))
            # Permit subpixel rounding only, not a whole-pixel or scale mismatch.
            if any(abs(image[k] - view[k] * scale) > 0.5 for k in ('width', 'height')):
                report['gaps'].append('pixel dimensions differ from declared logical viewport/scale; align content before exact comparison')
        else:
            report['gaps'].append('logical size or scale unknown; qualitative review only')
        if report['evidenceLevel'] == 'fixture':
            report['gaps'].append('fixture runner is not an iOS/Android app test')
        report['ok'] = report['runtime_checks'] != 'failed'
    except (ValueError, OSError) as exc:
        report.update(ok=False, capture='failed', errorType=type(exc).__name__)
        report['gaps'].append('native capture incomplete')
    (output / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


def main():
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('--spec', required=True); p.add_argument('--out', required=True)
    args = p.parse_args()
    try:
        report = collect(json.loads(Path(args.spec).read_text(encoding='utf-8')), args.out)
        print(json.dumps(report, ensure_ascii=False, indent=2)); return 0 if report['ok'] else 2
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({'ok':False, 'error':str(exc)}, ensure_ascii=False)); return 1


if __name__ == '__main__':
    raise SystemExit(main())
