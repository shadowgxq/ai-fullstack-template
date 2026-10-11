import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/shared/styles/global.css', 'utf8');
const themes = [...css.matchAll(/\[data-theme='(light|dark)'\]\s*{([^}]+)}/g)].map(
  ([, mode, declarations]) => ({
    mode,
    colors: Object.fromEntries(
      [...declarations.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(([, name, color]) => [
        name,
        color,
      ]),
    ),
  }),
);

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

const textPairs = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['secondary-foreground', 'secondary'],
  ['primary-foreground', 'primary'],
  ['primary-foreground', 'primary-hover'],
  ['primary-foreground', 'primary-active'],
  ['success', 'success-subtle'],
  ['success-foreground', 'success'],
  ['warning', 'warning-subtle'],
  ['warning-foreground', 'warning'],
  ['destructive', 'destructive-subtle'],
] as const;

const boundaryPairs = ['input', 'border-strong', 'ring', 'control-invalid-border'].flatMap(
  (boundary) => ['background', 'card', 'popover'].map((surface) => [boundary, surface] as const),
);

describe('semantic text color pairs', () => {
  it('has explicit light and dark palettes for nested previews', () => {
    expect(themes.map(({ mode }) => mode)).toEqual(['light', 'dark']);
  });

  for (const { mode, colors } of themes) {
    it.each(textPairs)(`${mode}: %s on %s meets normal text contrast`, (text, surface) => {
      expect(colors[text]).toBeDefined();
      expect(colors[surface]).toBeDefined();
      const first = luminance(colors[text]);
      const second = luminance(colors[surface]);
      const contrast = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    });

    it.each(boundaryPairs)(
      `${mode}: %s on %s meets necessary control contrast`,
      (edge, surface) => {
        expect(colors[edge]).toBeDefined();
        expect(colors[surface]).toBeDefined();
        const first = luminance(colors[edge]);
        const second = luminance(colors[surface]);
        const contrast = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
        expect(contrast).toBeGreaterThanOrEqual(3);
      },
    );
  }
});
