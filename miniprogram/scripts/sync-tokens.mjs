import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import {
  renderTabIcon,
  tabIconNames,
  tabIconPaths,
  renderLibraryIcon,
  libraryIconNames,
} from './tab-icons.mjs';

export const colorNames = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-hover',
  'primary-active',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'border-subtle',
  'border',
  'border-strong',
  'input',
  'ring',
  'destructive',
  'destructive-subtle',
  'control-invalid-border',
  'success',
  'success-subtle',
  'warning',
  'warning-subtle',
  'surface-hover',
  'surface-selected',
  'header-bg',
  'header-border',
  'overlay',
  'success-foreground',
  'warning-foreground',
  'primary-subtle',
  'primary-subtle-hover',
];

export function extractColors(css) {
  const modes = { light: {}, dark: {} };
  postcss.parse(css).walkRules((rule) => {
    const mode = rule.selectors?.includes(':root')
      ? 'light'
      : rule.selectors?.includes("[data-theme='dark']")
        ? 'dark'
        : null;
    if (!mode) return;
    rule.walkDecls((decl) => {
      const name = decl.prop.slice(2);
      if (!colorNames.includes(name)) return;
      if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(decl.value)) {
        throw new Error(`Unsupported color ${mode}.${name}: ${decl.value}`);
      }
      if (name in modes[mode]) throw new Error(`Duplicate color ${mode}.${name}`);
      modes[mode][name] = decl.value.toLowerCase();
    });
  });
  for (const [mode, colors] of Object.entries(modes)) {
    for (const name of colorNames) {
      if (!colors[name]) throw new Error(`Missing color ${mode}.${name}`);
    }
  }
  return modes;
}

export function renderPalette(modes) {
  return (
    '// Generated from frontend/src/shared/styles/global.css; do not edit.\n' +
    Object.entries(modes)
      .map(([mode, colors]) => {
        const selector =
          mode === 'light' ? 'page, .mp-theme-root.theme-light' : '.mp-theme-root.theme-dark';
        return `${selector} {\n${colorNames.map((key) => `  --mp-ref-color-${key}: ${colors[key]};`).join('\n')}\n}\n`;
      })
      .join('\n')
  );
}

export async function syncTokens(check = false) {
  const css = await readFile(
    new URL('../../frontend/src/shared/styles/global.css', import.meta.url),
    'utf8',
  );
  const colors = extractColors(css);
  const native = Object.fromEntries(
    Object.entries(colors).map(([mode, p]) => [
      mode,
      {
        navigationBackground: p['header-bg'],
        tintedNavigationBackground: p['surface-selected'],
        navigationText: mode === 'dark' ? 'white' : 'black',
        background: p.background,
        progressTrack: p.muted,
        tabBackground: p.card,
        tabText: p['muted-foreground'],
        tabSelected: p.primary,
        tabBorder: mode === 'dark' ? 'black' : 'white',
        ...tabIconPaths(mode),
      },
    ]),
  );
  const outputs = [
    ['../src/shared/styles/palette.generated.scss', renderPalette(colors)],
    ['../src/theme.generated.json', JSON.stringify(native, null, 2) + '\n'],
    [
      '../src/shared/theme/native.generated.ts',
      '// Generated from the shared color source; do not edit.\nexport const nativeThemes = ' +
        JSON.stringify(native, null, 2) +
        ' as const;\n',
    ],
  ];
  for (const [mode, palette] of Object.entries(colors)) {
    for (const name of libraryIconNames) {
      for (const [tone, color] of Object.entries({
        text: palette.foreground,
        muted: palette['muted-foreground'],
        primary: palette.primary,
      })) {
        outputs.push([
          `../src/assets/library-icons/${name}-${mode}-${tone}.png`,
          renderLibraryIcon(name, color),
        ]);
      }
    }
    for (const name of tabIconNames) {
      for (const selected of [false, true]) {
        outputs.push([
          `../src/assets/tabbar/${name}-${mode}${selected ? '-selected' : ''}.png`,
          renderTabIcon(name, palette[selected ? 'primary' : 'muted-foreground'], selected),
        ]);
      }
    }
  }
  for (const [path, content] of outputs) {
    const target = new URL(path, import.meta.url);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (check) {
      const existing = await readFile(target).catch(() => null);
      if (!existing?.equals(bytes)) {
        throw new Error(`Token output is stale: ${path}. Run pnpm tokens.`);
      }
    } else {
      await mkdir(new URL('.', target), { recursive: true });
      await writeFile(target, bytes);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await syncTokens(process.argv.includes('--check'));
}
