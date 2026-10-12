import test from 'node:test';
import assert from 'node:assert/strict';
import { compareValue, normalizeColor, size, parseArgs, collect, captureOutputPaths } from '../scripts/web.mjs';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('typed length, radius, typography and exact color checks', () => {
  assert.equal(compareValue('16.4px','16px','font-size').match,true);
  assert.equal(compareValue('17px','16px','font-size').match,false);
  assert.equal(compareValue('8.5px','8px','border-radius').match,true);
  assert.equal(compareValue('8.6px','8px','border-radius').match,false);
  assert.equal(compareValue('25px','24px','padding-top').match,true);
  assert.equal(compareValue(120.9,120,'width').match,true);
  assert.equal(compareValue(122,120,'width').match,false);
  assert.equal(compareValue('24.1px',{value:'24px',tolerance:0},'gap').match,false);
  assert.equal(compareValue('rgb(36, 84, 166)','#2454a6','color').match,true);
  assert.equal(compareValue('#2454a7','#2454a6','color').match,false);
  assert.equal(compareValue(undefined,'16px','font-size').match,false);
});

test('color normalization preserves alpha and supports short hex', () => {
  assert.equal(normalizeColor('#abc'),'#aabbcc');
  assert.equal(normalizeColor('rgba(0, 0, 0, 0.5)'),'#00000080');
  assert.equal(normalizeColor('rgb(255 0 0 / 50%)'),'#ff000080');
  assert.equal(normalizeColor('#ffffffFF'),'#ffffff');
  assert.equal(normalizeColor('transparent'),'#00000000');
});

test('invalid tolerance and implicit viewport are rejected', () => {
  for (const value of [-1,NaN,Infinity,'1']) assert.throws(() => compareValue(1,{value:1,tolerance:value}));
  for (const value of [undefined,'0x200','-1x200','390xNaN','390']) assert.throws(() => size(value));
  assert.deepEqual(size('390x844'),{width:390,height:844});
});

test('strict CLI arguments do not silently ignore mistakes', () => {
  assert.deepEqual(parseArgs(['--url','http://localhost','--viewport','390x844','--no-full-page']),{url:'http://localhost',viewport:'390x844','full-page':false});
  for (const argv of [['--unknown','x'],['--url'],['extra'],['--url','one','--url','two']]) assert.throws(() => parseArgs(argv));
});


test('relative and absolute clip output aliases are rejected before starting the browser', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'design-qa-alias-'));
  try {
    const out = path.join(dir, 'shots', 'page.png');
    const aliases = [out, path.join(dir, 'shots', '.', 'page.png'), path.join(dir, 'shots', '..', 'shots', 'page.png'), out.toUpperCase()];
    for (const alias of aliases) {
      const args = { url: 'http://localhost:1', out, clip: '390x300', 'clip-out': alias, viewport: '390x844' };
      await assert.rejects(() => collect(args), /aliases another output/);
      assert.equal(existsSync(out), false);
    }
    const normal = captureOutputPaths({ out, clip: '390x300', 'clip-out': path.join(dir, 'shots', 'frame.png') });
    assert.equal(normal.clipOutput, path.join(dir, 'shots', 'frame.png'));
    assert.equal(normal.outputs.length, 4);
    assert.throws(() => captureOutputPaths({out, 'clip-out':out}), /requires clip/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
