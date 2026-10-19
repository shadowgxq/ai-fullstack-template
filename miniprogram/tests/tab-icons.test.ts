import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { nativeThemes } from '../src/shared/theme/native.generated';
// @ts-expect-error Build-only Node ESM generator, not part of the app runtime.
import { renderTabIcon, tabIconNames, tabIconPaths } from '../scripts/tab-icons.mjs';

function decodePixels(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(81);
  expect(png.readUInt32BE(20)).toBe(81);
  expect(png[25]).toBe(6);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length; ) {
    const size = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      chunks.push(png.subarray(offset + 8, offset + 8 + size));
    }
    offset += size + 12;
  }
  const scanlines = inflateSync(Buffer.concat(chunks));
  expect(scanlines.length).toBe(81 * (81 * 4 + 1));
  const rows: Buffer[] = [];
  for (let row = 0; row < 81; row += 1) {
    const start = row * (81 * 4 + 1);
    expect(scanlines[start]).toBe(0);
    rows.push(scanlines.subarray(start + 1, start + 1 + 81 * 4));
  }
  return Buffer.concat(rows);
}

it.each(['light', 'dark'] as const)(
  'ships deterministic %s PNGs using native theme colors',
  async (mode) => {
    const theme = nativeThemes[mode];
    const paths = tabIconPaths(mode);
    for (const name of tabIconNames) {
      const title = name[0].toUpperCase() + name.slice(1);
      for (const selected of [false, true]) {
        const key = `tab${title}${selected ? 'Selected' : ''}Icon`;
        const color = selected ? theme.tabSelected : theme.tabText;
        const png = await readFile(new URL(`../src/${paths[key]}`, import.meta.url));
        expect(theme).toHaveProperty(key, paths[key]);
        expect(png.length).toBeLessThan(40 * 1024);
        expect(png).toEqual(renderTabIcon(name, color, selected));
        const pixels = decodePixels(png);
        const alpha = Array.from(pixels).filter((_, index) => index % 4 === 3);
        expect(alpha).toContain(0);
        expect(alpha).toContain(255);
        expect(alpha.some((value) => value > 0 && value < 255)).toBe(true);
        const visible = alpha.findIndex((value) => value === 255) * 4;
        expect(pixels.subarray(visible, visible + 3).toString('hex')).toBe(color.slice(1));
      }
    }
  },
);

it('distinguishes selection by silhouette as well as color', () => {
  for (const name of tabIconNames) {
    const normal = decodePixels(renderTabIcon(name, '#00857c'));
    const selected = decodePixels(renderTabIcon(name, '#00857c', true));
    expect(normal).not.toEqual(selected);
  }
});

it('rejects unknown shapes and colors instead of silently producing the wrong asset', () => {
  expect(() => renderTabIcon('missing', '#00857c')).toThrow('Unknown');
  expect(() => renderTabIcon('home', 'var(--primary)')).toThrow('Unsupported');
});
