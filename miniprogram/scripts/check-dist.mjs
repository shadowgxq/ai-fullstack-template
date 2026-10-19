import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const root = new URL('../dist/', import.meta.url);
const app = JSON.parse(await readFile(new URL('app.json', root), 'utf8'));
assert.equal(app.window.navigationStyle, 'default');
assert.equal(app.tabBar.list.length, 3);
assert.equal(app.darkmode, true);
for (const page of app.pages) {
  for (const ext of ['js', 'json', 'wxml'])
    assert.ok((await stat(new URL(`${page}.${ext}`, root))).size > 0);
}
const theme = JSON.parse(await readFile(new URL(app.themeLocation, root), 'utf8'));
assert.ok(theme.light.navigationBackground && theme.dark.navigationBackground);
// Taro 可将 app.wxss 拆成引用，检查实际可达样式而非假定单个文件包含全部内容。
async function readStyles(url, seen = new Set()) {
  assert.ok(url.href.startsWith(root.href), 'WXSS import escapes dist');
  if (seen.has(url.href)) return '';
  seen.add(url.href);
  const text = await readFile(url, 'utf8');
  let result = text;
  for (const match of text.matchAll(/@import\s+["']([^"']+)["']/g))
    result += await readStyles(new URL(match[1], url), seen);
  return result;
}
const styles = await readStyles(new URL('app.wxss', root));
assert.ok(styles.includes('--mp-ref-color-primary'));
assert.ok(styles.includes('--mp-button-min-height'));
assert.ok(styles.includes('.theme-dark'));
assert.ok(styles.includes('safe-area-inset-bottom'));
console.log('Verified WeChat build: pages, native navigation, themes and mobile tokens.');
