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
assert.equal(app.tabBar.borderStyle, 'white');
for (const mode of ['light', 'dark']) {
  assert.ok(['white', 'black'].includes(theme[mode].tabBorder));
  for (const item of app.tabBar.list) {
    for (const property of ['iconPath', 'selectedIconPath']) {
      const reference = item[property];
      assert.ok(typeof reference === 'string' && reference.startsWith('@'));
      const path = theme[mode][reference.slice(1)];
      assert.ok(typeof path === 'string' && path.endsWith('.png'));
      const url = new URL(path, root);
      assert.ok(url.href.startsWith(new URL('assets/tabbar/', root).href));
      const bytes = await readFile(url);
      assert.ok(bytes.length > 24 && bytes.length < 40 * 1024);
      assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.equal(bytes.readUInt32BE(16), 81);
      assert.equal(bytes.readUInt32BE(20), 81);
    }
  }
}
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
console.log('Verified WeChat build: pages, native navigation, themed icons and mobile tokens.');
