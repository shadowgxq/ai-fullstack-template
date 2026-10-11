import { readFileSync } from 'node:fs';

import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

const sources = ['button', 'input', 'textarea', 'select', 'switch', 'tabs', 'label'].map((name) =>
  readFileSync(`src/shared/ui/${name}.tsx`, 'utf8'),
);

async function compileControlUtilities() {
  const candidates = sources.flatMap((source) => source.match(/[^\s"'\x60]+/g) ?? []);
  const compiler = await compile('@tailwind utilities;');
  return compiler.build(candidates);
}

describe('control token utilities', () => {
  it('emits font-size and border-width rather than color declarations for length tokens', async () => {
    const css = await compileControlUtilities();

    expect(css).toContain('font-size: var(--text-control-size)');
    expect(css).toContain('font-size: var(--label-font-size)');
    expect(css).toContain('border-width: var(--control-border-width)');
    expect(css).not.toContain('color: var(--font-size-md)');
    expect(css).not.toContain('border-color: var(--control-border-width)');
  });

  it('emits visible focus shadows and their offset from the control contract', async () => {
    const css = await compileControlUtilities();

    expect(css).toContain('calc(var(--focus-ring-width) + var(--tw-ring-offset-width))');
    expect(css).toContain('calc(var(--control-focus-stroke) + var(--tw-ring-offset-width))');
    expect(css).toContain('--tw-ring-offset-width: var(--focus-ring-offset)');
    expect(css).toContain('var(--tw-ring-offset-width) var(--tw-ring-offset-color)');
  });
});
