import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';

// Build-only SVG rasterizer; pass an installed sharp module path when regenerating the masks.
const require = createRequire(import.meta.url);
const sharp = require(process.argv[2] || 'sharp');
const shapes = JSON.parse(await readFile(new URL('./icon-shapes.json', import.meta.url), 'utf8'));
const masks = {};
for (const [name, nodes] of Object.entries(shapes)) {
  const elements = nodes
    .map(
      ([tag, attributes]) =>
        `<${tag} ${Object.entries(attributes)
          .filter(([key]) => key !== 'key')
          .map(([key, value]) => `${key}="${value}"`)
          .join(' ')}/>`,
    )
    .join('');
  masks[name] = {};
  for (const [variant, width] of [
    ['normal', 1.8],
    ['selected', 2.2],
  ]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${elements}</svg>`;
    const rgba = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    const alpha = Buffer.alloc(81 * 81);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    masks[name][variant] = deflateSync(alpha).toString('base64');
  }
}
await writeFile(
  new URL('./icon-masks.json', import.meta.url),
  JSON.stringify(masks, null, 2) + '\n',
);
