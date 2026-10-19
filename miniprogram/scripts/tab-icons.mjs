import { deflateSync } from 'node:zlib';

export const tabIconNames = ['home', 'components', 'profile'];
const iconSize = 81;
const samplesPerAxis = 3;

function insideRoundedRect(x, y, left, top, width, height, radius) {
  const dx = x - Math.max(left + radius, Math.min(x, left + width - radius));
  const dy = y - Math.max(top + radius, Math.min(y, top + height - radius));
  return dx * dx + dy * dy <= radius * radius;
}

function nearLine(x, y, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const fraction = Math.max(
    0,
    Math.min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(x - start[0] - fraction * dx, y - start[1] - fraction * dy) <= 0.85;
}

function coversPixel(name, selected, x, y) {
  if (name === 'components') {
    return [3.8, 13.8].some((left) =>
      [3.8, 13.8].some(
        (top) =>
          insideRoundedRect(x, y, left, top, 6.4, 6.4, 1.4) &&
          (selected || !insideRoundedRect(x, y, left + 1.7, top + 1.7, 3, 3, 0.4)),
      ),
    );
  }
  if (name === 'profile') {
    const headDistance = Math.hypot(x - 12, y - 7.5);
    const head = headDistance <= 3.3 && (selected || headDistance >= 1.6);
    const body =
      insideRoundedRect(x, y, 5, 13, 14, 7, 3.5) &&
      (selected || !insideRoundedRect(x, y, 6.7, 14.7, 10.6, 3.6, 1.8));
    return head || body;
  }
  if (selected) {
    const roof = y >= 3.8 + Math.abs(x - 12) * 0.8 && y <= 10.2;
    const house = x >= 5.8 && x <= 18.2 && y >= 9 && y <= 20.2;
    const doorway = x > 10 && x < 14 && y > 13.5;
    return (roof || house) && !doorway;
  }
  const outline = [
    [3.8, 10.4, 12, 3.8],
    [12, 3.8, 20.2, 10.4],
    [5.8, 9, 5.8, 20.2],
    [5.8, 20.2, 18.2, 20.2],
    [18.2, 20.2, 18.2, 9],
    [10, 20.2, 10, 13.5],
    [10, 13.5, 14, 13.5],
    [14, 13.5, 14, 20.2],
  ];
  return outline.some(([x1, y1, x2, y2]) => nearLine(x, y, [x1, y1], [x2, y2]));
}

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

/** Offline, deterministic PNG assets; no font, network image or native raster dependency. */
export function renderTabIcon(name, color, selected = false) {
  if (!tabIconNames.includes(name)) throw new Error(`Unknown tab icon: ${name}`);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Unsupported icon color: ${color}`);
  const rgb = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const scanlines = Buffer.alloc(iconSize * (1 + iconSize * 4));
  for (let y = 0; y < iconSize; y += 1) {
    for (let x = 0; x < iconSize; x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < samplesPerAxis; sy += 1) {
        for (let sx = 0; sx < samplesPerAxis; sx += 1) {
          const px = ((x + (sx + 0.5) / samplesPerAxis) * 24) / iconSize;
          const py = ((y + (sy + 0.5) / samplesPerAxis) * 24) / iconSize;
          if (coversPixel(name, selected, px, py)) coverage += 1;
        }
      }
      const offset = y * (1 + iconSize * 4) + 1 + x * 4;
      scanlines.set(rgb, offset);
      scanlines[offset + 3] = Math.round((coverage * 255) / samplesPerAxis ** 2);
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
