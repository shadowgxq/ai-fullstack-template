// Shared Web evidence collector. React/Vue use the same browser, not RN native.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const readJSON = f => JSON.parse(readFileSync(f, 'utf8'));

export function parseArgs(argv) {
  const args = {};
  const flags = new Set(['full-page', 'no-full-page']);
  const keys = new Set(['url','out','viewport','dpr','ready','checks','actions','storage-state','wait-until','timeout','settle','clip','clip-out','snapshot','target','build']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--')) throw new Error('unexpected positional argument');
    if (flags.has(key)) { args['full-page'] = key === 'full-page'; continue; }
    if (!keys.has(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`invalid argument: ${key}`);
    if (Object.hasOwn(args, key)) throw new Error(`duplicate argument: ${key}`);
    args[key] = argv[++i];
  }
  return args;
}

export function positive(value, name, max = 100000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error(`invalid ${name}`);
  return n;
}

export function size(value) {
  const m = /^(\d+)x(\d+)$/.exec(String(value));
  if (!m) throw new Error('explicit logical viewport WxH required; do not infer @2x');
  return { width: positive(m[1], 'width', 16384), height: positive(m[2], 'height', 16384) };
}

export function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 33 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || b.toString('ascii', 12, 16) !== 'IHDR') throw new Error('invalid PNG evidence');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

export function normalizeColor(value) {
  let s = String(value).trim().toLowerCase();
  if (/^#[0-9a-f]{3,4}$/.test(s)) s = '#' + [...s.slice(1)].map(c => c + c).join('');
  if (/^#[0-9a-f]{8}$/.test(s) && s.endsWith('ff')) return s.slice(0, 7);
  if (s === 'transparent') return '#00000000';
  const m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!m) return s;
  const parts = m[1].split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return s;
  const channel = v => Math.round(v.endsWith('%') ? parseFloat(v) * 2.55 : Number(v));
  const rgb = parts.slice(0, 3).map(channel);
  let alpha = parts.length === 4 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : Number(parts[3])) : 1;
  if (rgb.some(n => !Number.isFinite(n) || n < 0 || n > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) return s;
  return '#' + [...rgb, ...(alpha < 1 ? [Math.round(alpha * 255)] : [])].map(n => n.toString(16).padStart(2, '0')).join('');
}

export function compareValue(actual, expected, property = '') {
  const rule = expected && typeof expected === 'object' ? expected : { value: expected };
  const wanted = rule.value;
  if (wanted === undefined || wanted === null || typeof wanted === 'boolean') throw new Error('invalid expected value');
  const tolerance = rule.tolerance ?? (/font-size|radius|border.*width/.test(property) ? 0.5 : /^(width|height|x|y)$|padding|margin|gap|line-height|spacing|top|left|right|bottom/.test(property) ? 1 : 0);
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('invalid tolerance');
  const number = v => /^(-?\d+(?:\.\d+)?)(px)?$/.exec(String(v).trim());
  const a = number(actual), e = number(wanted);
  if (a && e && ((a[2] ?? '') === (e[2] ?? '') || Number(a[1]) === 0 || Number(e[1]) === 0)) {
    return { match: Math.abs(Number(a[1]) - Number(e[1])) <= tolerance + 1e-8, actual, expected: wanted, tolerance };
  }
  return { match: normalizeColor(actual) === normalizeColor(wanted), actual, expected: wanted, tolerance: 0 };
}

function playwright() {
  const bases = [path.join(process.env.DESIGN_QA_NODE_ROOT || process.cwd(), 'package.json'), import.meta.url];
  for (const base of bases) for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    try { return createRequire(base)(name); } catch { /* Try only already-installed dependencies. */ }
  }
  throw new Error('Playwright unavailable; use the target project dependency or DESIGN_QA_NODE_ROOT');
}

async function actionsOn(page, actions, timeout) {
  if (!Array.isArray(actions)) throw new Error('actions must be an array');
  let assertions = 0;
  for (const a of actions) {
    if (!a || !['click','fill','hover','wait','assert'].includes(a.type)) throw new Error('unsupported state action');
    if (a.type === 'wait' && !a.selector) { await page.waitForTimeout(positive(a.ms ?? 100, 'wait', timeout)); continue; }
    if (typeof a.selector !== 'string' || !a.selector) throw new Error('action requires selector');
    const loc = page.locator(a.selector);
    if (a.type === 'assert') {
      if (a.count === undefined && a.visible === undefined && a.text === undefined) throw new Error('assert requires count, visible, or text');
      await page.waitForFunction(({ selector, count, visible, text }) => {
        const es = [...document.querySelectorAll(selector)];
        if (count !== undefined && es.length !== count) return false;
        if ((visible !== undefined || text !== undefined) && es.length !== 1) return false;
        if (visible !== undefined) { const e = es[0], s = getComputedStyle(e), r = e.getBoundingClientRect(); if ((s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0) !== visible) return false; }
        return text === undefined || es[0].textContent.trim() === String(text);
      }, a, { timeout });
      assertions++;
    } else if (a.type === 'wait') await loc.waitFor({ state: 'visible', timeout: a.ms ?? timeout });
    else if (a.type === 'fill') await loc.fill(String(a.value ?? ''), { timeout });
    else await loc[a.type]({ timeout });
  }
  return assertions;
}

async function stabilize(page, selectors, timeout, settle) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.waitForFunction(() => (!document.fonts || document.fonts.status === 'loaded') && [...document.images].every(i => i.complete), null, { timeout });
  const broken = await page.evaluate(() => [...document.images].filter(i => !i.naturalWidth).length);
  if (broken) throw new Error('broken image resources');
  await page.waitForTimeout(settle);
  let previous, same = 0;
  for (let i = 0; i < 8; i++) {
    const sample = await page.evaluate(selectors => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      boxes: selectors.map(s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; })) }), selectors);
    const next = JSON.stringify(sample);
    same = previous === next ? same + 1 : 0;
    if (same >= 2) return;
    previous = next;
    await page.waitForTimeout(100);
  }
  throw new Error('layout did not stabilize');
}

export async function inspectPage(page, checks) {
  if (!Array.isArray(checks)) throw new Error('checks must be an array');
  const results = [];
  for (const check of checks) {
    if (!check || typeof check.selector !== 'string') throw new Error('check requires selector');
    const locator = page.locator(check.selector), count = await locator.count();
    const entry = { name: check.name ?? check.selector, selector: check.selector, count, found: count === 1, mismatches: [] };
    if (count !== 1) entry.mismatches.push({ kind: count ? 'ambiguous-selector' : 'missing-element', actual: count, expected: 1 });
    else {
      entry.visible = await locator.isVisible();
      if (!entry.visible) entry.mismatches.push({ kind: 'invisible-element' });
      const properties = [...new Set([...(check.properties ?? []), ...Object.keys(check.expect ?? {})])];
      entry.styles = await locator.evaluate((el, props) => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p).trim()])); }, properties);
      for (const [prop, value] of Object.entries(entry.styles)) entry.styles[prop] = normalizeColor(value);
      for (const [prop, expected] of Object.entries(check.expect ?? {})) { const comparison = compareValue(entry.styles[prop], expected, prop); if (!comparison.match) entry.mismatches.push({ property: prop, ...comparison }); }
      if (check.box || check.expectBox) entry.box = await locator.boundingBox();
      for (const [prop, expected] of Object.entries(check.expectBox ?? {})) { if (!['x','y','width','height'].includes(prop)) throw new Error('invalid box property'); const comparison = compareValue(entry.box?.[prop], expected, prop); if (!comparison.match) entry.mismatches.push({ property: 'box.' + prop, ...comparison }); }
    }
    results.push(entry);
  }
  return results;
}

export function captureOutputPaths(args, inspectOnly = false) {
  if (args['clip-out'] && !args.clip) throw new Error('clip-out requires clip');
  if (inspectOnly && args.clip) throw new Error('inspection cannot request a screenshot clip');
  const output = args.out ? path.resolve(args.out) : null;
  const clipOutput = !inspectOnly && args.clip ? path.resolve(args['clip-out'] || output + '.clip.png') : null;
  const outputs = inspectOnly ? [output] : [output, output + '.measurements.json', output + '.result.json', ...(clipOutput ? [clipOutput] : [])];
  const files = outputs.filter(Boolean);
  // Conservative portable identity: outputs must be distinct on case-insensitive
  // platforms too. Resolve every destination before checking or writing any PNG.
  const names = files.map(f => f.normalize('NFC').toLowerCase());
  if (new Set(names).size !== files.length || files.some(f => existsSync(f)))
    throw new Error('evidence output already exists or aliases another output; use a new run path');
  return { output, clipOutput, outputs: files };
}

export async function collect(args, inspectOnly = false) {
  if (!args.url || (!args.out && !inspectOnly)) throw new Error('url and output path required');
  const url = new URL(args.url);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('http(s) URL without credentials required');
  const viewport = size(args.viewport), dpr = positive(args.dpr ?? 1, 'dpr', 8), timeout = positive(args.timeout ?? 30000, 'timeout', 300000);
  const settle = Number(args.settle ?? 100);
  if (!Number.isFinite(settle) || settle < 0 || settle > timeout) throw new Error('invalid settle delay');
  const waitUntil = args['wait-until'] ?? 'domcontentloaded';
  if (!['domcontentloaded','load','networkidle'].includes(waitUntil)) throw new Error('invalid navigation wait condition');
  const checks = args.checks ? readJSON(args.checks) : [], actions = args.actions ? readJSON(args.actions) : [];
  if (!Array.isArray(checks) || !Array.isArray(actions)) throw new Error('checks/actions must be arrays');
  const { output, clipOutput, outputs } = captureOutputPaths(args, inspectOnly);
  for (const f of outputs) mkdirSync(path.dirname(f), { recursive: true });
  if (!inspectOnly && !/\.png$/i.test(output)) throw new Error('capture output must be PNG');
  const { chromium } = playwright();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, reducedMotion: 'reduce', ...(args['storage-state'] ? { storageState: args['storage-state'] } : {}) });
    const page = await context.newPage(), failures = [], pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.name || 'Error'));
    await page.goto(args.url, { waitUntil, timeout });
    let assertions = 0;
    try { assertions = await actionsOn(page, actions, timeout); } catch (e) { failures.push({ kind: 'state-action-failed', errorType: e.name }); }
    try {
      if (args.ready) await page.locator(args.ready).waitFor({ state: 'visible', timeout });
      await stabilize(page, ['body', ...checks.map(c => c.selector)], timeout, settle);
    } catch (e) { failures.push({ kind: 'readiness-or-stability-failed', errorType: e.name }); }
    const measurements = await inspectPage(page, checks);
    const mismatches = measurements.reduce((n, e) => n + e.mismatches.length, 0);
    let image = null, clip = null;
    if (!inspectOnly) {
      await page.screenshot({ path: output, fullPage: args['full-page'] !== false, animations: 'disabled' });
      image = { out: output, ...pngSize(output) };
      if (args.clip) { const bounds = size(args.clip); await page.screenshot({ path: clipOutput, clip: { x: 0, y: 0, ...bounds } }); clip = { out: clipOutput, ...pngSize(clipOutput) }; }
    }
    const hasExpected = checks.some(c => Object.keys(c.expect ?? {}).length || Object.keys(c.expectBox ?? {}).length);
    const result = { platform: 'web', url: url.origin + url.pathname, viewport, dpr, capturedAt: new Date().toISOString(),
      snapshot: args.snapshot ?? null, target: args.target ?? null, build: args.build ?? null,
      actionsHash: hash(actions), ready: args.ready ?? null, assertions, image, clip,
      measurement_checks: mismatches ? 'failed' : hasExpected ? 'passed' : 'not_run',
      code_checks: 'not_run', runtime_checks: failures.length || pageErrors.length ? 'failed' : assertions ? 'passed' : 'not_run',
      visual_checks: 'not_run', failures, pageErrors, mismatches,
      evidenceGaps: ['visual comparison not performed', ...(!args.snapshot || !args.target || !args.build ? ['provenance incomplete'] : [])] };
    if (inspectOnly) { if (output) writeFileSync(output, JSON.stringify(measurements, null, 2)); }
    else { writeFileSync(output + '.measurements.json', JSON.stringify(measurements, null, 2)); writeFileSync(output + '.result.json', JSON.stringify(result, null, 2)); }
    return { result, measurements, exitCode: failures.length || pageErrors.length || mismatches ? 2 : 0 };
  } finally { await browser.close(); }
}

export async function cli(inspectOnly = false) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (inspectOnly && !args.checks) throw new Error('inspect requires --checks');
    const collected = await collect(args, inspectOnly);
    console.log(JSON.stringify(inspectOnly && !args.out ? collected.measurements : collected.result, null, 2));
    return collected.exitCode;
  } catch (e) { console.error(JSON.stringify({ ok: false, error: e.message })); return 1; }
}
