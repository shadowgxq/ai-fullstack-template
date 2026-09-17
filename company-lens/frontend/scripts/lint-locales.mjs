#!/usr/bin/env node
/**
 * i18n locale 禁用词扫描：locale 文件只放生产文案，开发态提示禁止进入。
 *
 * 背景：sector-alpha 登录页曾把 mock 行为提示（"验证码不正确（开发态：任意 6 位数字）"、
 * "admin / admin123"）写进 locale，接真实 API 后遗留到线上 UI，并把测试账号暴露给用户。
 * locale 是生产文案通道，开发备忘写进去后形式上无法与正式文案区分，mock → API 的数据源
 * 切换也不触发任何文案审查，因此需要一道机械检查。
 *
 * 规则见 docs/frontend/guides/theming-and-i18n.md「文案边界」。
 *
 * 用法：node scripts/lint-locales.mjs [localesDir]
 *   localesDir 相对项目根，默认 src/shared/i18n/locales；i18n opt-out 的项目自动跳过。
 *
 * 白名单：scripts/lint-locales.allowlist.json，形如
 *   { "note": "...", "allowlist": { "zh.json:share.uploadDevelopment": "保留理由" } }
 * 条目失效（key 已删或文案已改）同样报错，强制与文案同步清理。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN = [
  { name: '开发态', pattern: /开发态/ },
  { name: 'admin123', pattern: /admin123/i },
  { name: 'dev', pattern: /\bdev(elopment)?\b/i },
  { name: 'TODO/FIXME', pattern: /\b(TODO|FIXME)\b/ },
  { name: 'mock', pattern: /\bmock\b/i },
];

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = resolve(projectRoot, process.argv[2] ?? 'src/shared/i18n/locales');
const allowlistPath = join(projectRoot, 'scripts', 'lint-locales.allowlist.json');

if (!existsSync(localesDir)) {
  console.log(`lint:locales 跳过（未找到 ${localesDir}，项目未启用 i18n）`);
  process.exit(0);
}

const allowlist = existsSync(allowlistPath)
  ? (JSON.parse(readFileSync(allowlistPath, 'utf8')).allowlist ?? {})
  : {};

function* flatten(node, path = '') {
  if (typeof node === 'string') {
    yield [path, node];
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      yield* flatten(value, path ? `${path}.${key}` : key);
    }
  }
}

const violations = [];
const allowlistHits = new Set();
const files = readdirSync(localesDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

for (const file of files) {
  const content = JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
  for (const [keyPath, text] of flatten(content)) {
    const rule = FORBIDDEN.find((r) => r.pattern.test(text));
    if (!rule) continue;
    const id = `${file}:${keyPath}`;
    if (id in allowlist) {
      allowlistHits.add(id);
    } else {
      violations.push({ id, rule: rule.name, text });
    }
  }
}

const stale = Object.keys(allowlist).filter((id) => !allowlistHits.has(id));

if (violations.length > 0) {
  console.error('locale 文案含禁用词（开发态提示不进 i18n，改为按数据源条件渲染或走 console）：');
  for (const v of violations) {
    console.error(`  ${v.id} [${v.rule}] → ${JSON.stringify(v.text)}`);
  }
}
if (stale.length > 0) {
  console.error('白名单条目已失效（key 已删或文案已改），请从 lint-locales.allowlist.json 移除：');
  for (const id of stale) {
    console.error(`  ${id}`);
  }
}

if (violations.length > 0 || stale.length > 0) {
  process.exit(1);
}
console.log(`lint:locales 通过（${files.length} 个 locale 文件，白名单 ${allowlistHits.size} 条）`);
