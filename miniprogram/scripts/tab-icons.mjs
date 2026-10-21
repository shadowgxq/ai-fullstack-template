import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

export const tabIconNames = ['home', 'components', 'profile'];
const masks = JSON.parse(readFileSync(new URL('./icon-masks.json', import.meta.url), 'utf8'));
export const libraryIconNames = Object.keys(masks);
const iconSize = 81;

function pngChunk(type, data) {
  const bytes = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, bytes, checksum]);
}

/** Recolor local Lucide stroke masks; no runtime font or SVG support is required. */
export function renderLibraryIcon(name, color, selected = false) {
  if (!libraryIconNames.includes(name)) throw new Error(`Unknown library icon: ${name}`);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Unsupported icon color: ${color}`);
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const alpha = inflateSync(Buffer.from(masks[name][selected ? 'selected' : 'normal'], 'base64'));
  if (alpha.length !== iconSize * iconSize) throw new Error(`Invalid icon mask: ${name}`);
  const scanlines = Buffer.alloc(iconSize * (1 + iconSize * 4));
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const offset = y * (1 + iconSize * 4) + 1 + x * 4;
      scanlines.set(rgb, offset);
      scanlines[offset + 3] = alpha[y * iconSize + x];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(iconSize, 0);
  header.writeUInt32BE(iconSize, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderTabIcon(name, color, selected = false) {
  if (!tabIconNames.includes(name)) throw new Error(`Unknown tab icon: ${name}`);
  return renderLibraryIcon(name === 'components' ? 'grid' : name, color, selected);
}

export function tabIconPaths(mode) {
  return Object.fromEntries(
    tabIconNames.flatMap((name) => [
      [`tab${name[0].toUpperCase() + name.slice(1)}Icon`, `assets/tabbar/${name}-${mode}.png`],
      [
        `tab${name[0].toUpperCase() + name.slice(1)}SelectedIcon`,
        `assets/tabbar/${name}-${mode}-selected.png`,
      ],
    ]),
  );
}
