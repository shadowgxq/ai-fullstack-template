import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
// Generated scripts are intentionally Node ESM, outside the app's runtime dependency graph.
// @ts-expect-error No runtime TS declaration is needed for this build-only generator.
import { extractColors, renderPalette } from '../scripts/sync-tokens.mjs';
const source = await readFile(
  new URL('../../frontend/src/shared/styles/global.css', import.meta.url),
  'utf8',
);
it('uses the current Web palette for both themes without importing Web sizing', async () => {
  const palette = renderPalette(extractColors(source));
  expect(palette).toBe(
    await readFile(new URL('../src/shared/styles/palette.generated.scss', import.meta.url), 'utf8'),
  );
  expect(palette).toContain('--mp-ref-color-primary: #00857c');
  expect(palette).toContain('--mp-ref-color-primary: #56cdbc');
  expect(palette).not.toContain('layout-max-width');
});
it('fails closed when a required upstream color disappears or is unsupported', () => {
  expect(() => extractColors(source.replace('--primary: #00857c;', ''))).toThrow('Missing');
  expect(() => extractColors(source.replace('--primary: #00857c;', '--primary: red;'))).toThrow(
    'Unsupported',
  );
});

it('resolves every mobile alias to an existing token without a cycle', async () => {
  const text =
    renderPalette(extractColors(source)) +
    (await readFile(new URL('../src/shared/styles/tokens.scss', import.meta.url), 'utf8'));
  const declarations = new Map<string, string>(
    Array.from(text.matchAll(/(--mp-[\w-]+):\s*([^;]+);/g), (match) => [match[1], match[2]]),
  );
  const visit = (name: string, path: Set<string>) => {
    expect(declarations.has(name), `Missing ${name}`).toBe(true);
    expect(path.has(name), `Cyclic ${name}`).toBe(false);
    for (const match of declarations.get(name)!.matchAll(/var\((--mp-[\w-]+)/g))
      visit(match[1], new Set([...path, name]));
  };
  for (const name of declarations.keys()) visit(name, new Set());
});
