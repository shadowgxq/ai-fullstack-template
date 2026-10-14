const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = 'http://127.0.0.1:8080';
const runId = process.env.QA_RUN_ID;
const runDir = runId ? path.resolve('qa/bookmarks/runs', runId) : null;
let browser;
let accounts;
let requests = [];
const contexts = new Set();
const stamp = () => new Date().toISOString();
function atomic(file, value) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
}
function state(edit) {
  assert(runDir, 'QA_RUN_ID is required for execution');
  const file = path.join(runDir, 'state.json');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(value);
  value.run.updated_at = stamp();
  const elapsed = Math.round((Date.now() - Date.parse(value.run.resumed_at || value.run.started_at)) / 1000);
  value.budget_usage.active_seconds = (value.budget_usage.checkpoint_seconds || 0) + elapsed;
  atomic(file, value);
}
async function eventually(check, timeout = 7000) {
  const until = Date.now() + timeout;
  let error;
  do {
    try { return await check(); } catch (e) { error = e; }
    await new Promise(r => setTimeout(r, 80));
  } while (Date.now() < until);
  throw error;
}
async function api(who, endpoint, payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (who?.token) headers.Authorization = 'Bearer ' + who.token;
  const method = options.method || (payload !== undefined ? 'POST' : 'GET');
  if (!['GET', 'HEAD'].includes(method) && !endpoint.startsWith('/auth/')) {
    headers['Idempotency-Key'] = options.key || crypto.randomUUID();
  }
  const response = await fetch(base + '/api/v1' + endpoint, {
    method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await response.json();
  requests.push({ at: stamp(), method, endpoint: endpoint.split('?')[0], status: response.status, code: body.code });
  if (options.status !== undefined) assert.equal(response.status, options.status, endpoint);
  else assert.equal(response.status, 200, endpoint + ': code=' + body.code);
  return { status: response.status, data: body.data, code: body.code };
}
async function init() {
  if (browser) return;
  assert(runDir && fs.existsSync(path.join(runDir, 'state.json')));
  const file = path.join(runDir, 'accounts.private.json');
  if (fs.existsSync(file)) accounts = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    accounts = {};
    for (const key of ['a', 'b']) accounts[key] = {
      username: 'qa_' + runId.replace(/[^a-z0-9]/gi, '') + '_' + key,
      password: 'Qa!' + crypto.randomBytes(18).toString('base64url'), registered: false,
    };
    atomic(file, accounts);
  }
  saveAccounts();
  browser = await chromium.launch({ headless: true });
  state(s => { s.run.stage = 'execute'; s.side_effects.push({ at: stamp(), kind: 'browser', version: browser.version() }); });
}
function saveAccounts() { atomic(path.join(runDir, 'accounts.private.json'), Object.fromEntries(Object.entries(accounts).map(([key, value]) => { const { token, ...safe } = value; return [key, safe]; }))); }
async function user(key = 'a') {
  await init();
  const account = accounts[key];
  if (!account.registered) {
    const result = await api(null, '/auth/register', { username: account.username, password: account.password });
    account.id = result.data.id; account.registered = true; saveAccounts();
  }
  const result = await api(null, '/auth/login', { username: account.username, password: account.password });
  account.token = result.data.access_token;
  // Tokens are deliberately kept in memory, never written to artifacts.
  return account;
}
async function list(who, query = '') { return (await api(who, '/bookmarks' + query)).data; }
async function all(who) {
  let data = await list(who), items = [...data.list];
  for (let page = 2; page <= Math.ceil(data.total / 10); page++) items.push(...(await list(who, '?page=' + page)).list);
  return items;
}
async function group(who, name) { return (await api(who, '/bookmark-groups', { name })).data.resource_id; }
async function bookmark(who, title, groupId = null, changes = {}) {
  const payload = { title, url: base + '/?qa=' + encodeURIComponent(title), group_id: groupId, note: '', ...changes };
  return (await api(who, '/bookmarks', payload)).data.resource_id;
}
async function detail(who, id) { return (await api(who, '/bookmarks/' + id)).data; }
async function clean() {
  if (!accounts) return;
  for (const account of Object.values(accounts)) {
    if (!account.registered) continue;
    assert(account.username.startsWith('qa_' + runId.replace(/[^a-z0-9]/gi, '')));
    if (!account.token) await user(account === accounts.a ? 'a' : 'b');
    const me = (await api(account, '/auth/me')).data;
    assert.equal(me.username, account.username, 'cleanup identity guard');
    const items = await all(account), groups = (await list(account)).groups;
    const ledgerFile = path.join(runDir, 'data-ledger.json');
    const ledger = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { reconciliations: [] };
    const entry = { at: stamp(), account_id: me.id, username: me.username, provenance: 'Authenticated reconciliation of the unique accounts created for this run; no pre-existing account is eligible.', bookmarks: items.map(x => x.id), groups: groups.map(x => x.id), deleted: false };
    ledger.reconciliations.push(entry); atomic(ledgerFile, ledger);
    for (const id of entry.bookmarks) await api(account, '/bookmarks/' + id, undefined, { method: 'DELETE' });
    for (const id of entry.groups) await api(account, '/bookmark-groups/' + id + '?expected_count=0', undefined, { method: 'DELETE' });
    const final = await list(account); assert.equal(final.all_count, 0); assert.equal(final.groups.length, 0);
    entry.deleted = true; entry.verified_at = stamp(); atomic(ledgerFile, ledger);
  }
}
async function page(options = {}) {
  await init();
  const mobile = Boolean(options.viewport && options.viewport.width < 768);
  const context = await browser.newContext({ viewport: options.viewport || { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, locale: 'en-US', colorScheme: 'light', reducedMotion: 'reduce' });
  contexts.add(context);
  await context.addInitScript(({ theme, locale }) => {
    if (!localStorage.getItem('ui-theme')) localStorage.setItem('ui-theme', JSON.stringify({ state: { mode: theme }, version: 0 }));
    if (!localStorage.getItem('ui-locale')) localStorage.setItem('ui-locale', JSON.stringify({ state: { locale }, version: 0 }));
  }, { theme: options.theme || 'light', locale: options.locale || 'en' });
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
    if (['http://127.0.0.1:8080', 'http://127.0.0.1:8000'].includes(url.origin)) return route.continue();
    if (req.method() === 'GET' && ['https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(url.origin)) return route.continue();
    requests.push({ at: stamp(), unexpected_external_origin: url.origin });
    return route.abort('blockedbyclient');
  });
  const p = await context.newPage(); p.setDefaultTimeout(6500);
  p.qaRequests=[];
  p.on('request',request=>{const url=new URL(request.url());if(url.origin===base&&url.pathname.startsWith('/api/v1/'))p.qaRequests.push({method:request.method(),endpoint:url.pathname});});
  p.on('response',response=>{const request=response.request(),url=new URL(response.url());if(url.origin===base&&url.pathname.startsWith('/api/v1/'))requests.push({at:stamp(),source:'browser',method:request.method(),endpoint:url.pathname,status:response.status()});});
  p.on('requestfailed',request=>{const url=new URL(request.url());if(url.origin===base&&url.pathname.startsWith('/api/v1/'))requests.push({at:stamp(),source:'browser',method:request.method(),endpoint:url.pathname,result:'transport_failure'});});
  await p.goto(base + '/bookmarks' + (options.query || ''));
  if (options.who) await login(p, options.who);
  return p;
}
async function login(p, who) {
  await p.getByRole('button', { name: 'Log in', exact: true }).click();
  const d = p.getByRole('dialog');
  await d.getByRole('textbox', { name: 'Username', exact: true }).fill(who.username);
  await d.getByLabel('Password', { exact: true }).fill(who.password);
  await d.getByRole('button', { name: 'Log in', exact: true }).click();
  await d.waitFor({ state: 'hidden' });
  await p.getByRole('heading', { name: 'Resource bookmarks', exact: true }).waitFor();
  await addButton(p).waitFor();
}
function addButton(p) { return p.getByRole('heading', { name: 'Resource bookmarks', exact: true }).locator('..').getByRole('button', { name: 'Add bookmark', exact: true }); }
async function loaded(p, title) {
  await p.reload();
  if (title) await p.getByRole('heading', { name: title, exact: true }).waitFor();
  await p.getByRole('checkbox', { name: /^Select current page/ }).waitFor();
}
async function save(p, values, editing = false) {
  if (!editing) await addButton(p).click();
  const d = p.getByRole('dialog');
  await d.getByLabel('Title', { exact: false }).fill(values.title);
  await d.getByLabel('Link', { exact: false }).fill(values.url || base + '/?qa=ui');
  if (values.note !== undefined) await d.getByLabel('Note', { exact: false }).fill(values.note);
  if (values.groupName) { await d.getByRole('combobox', { name: 'Group', exact: false }).click(); await p.getByRole('option', { name: values.groupName, exact: true }).click(); }
  await d.getByRole('button', { name: editing ? 'Save changes' : 'Save bookmark', exact: true }).click();
  await d.waitFor({ state: 'hidden' });
}
async function menu(p, title, action) {
  await p.getByRole('button', { name: 'More actions for ' + title, exact: true }).click();
  await p.getByRole('menuitem', { name: action, exact: true }).click();
}
async function groupMenu(p, name, action) {
  await p.getByRole('button', { name: 'Actions for group ' + name, exact: true }).click();
  await p.getByRole('menuitem', { name: action, exact: true }).click();
}
async function move(p, count, target) {
  await p.getByRole('combobox', { name: 'Move to group', exact: true }).click();
  await p.getByRole('option', { name: target, exact: true }).click();
  await p.getByRole('button', { name: `Move ${count} bookmarks`, exact: true }).click();
  await p.getByRole('group', { name: 'Batch bookmark move' }).waitFor({ state: 'hidden' });
}
async function logout(p, who) {
  const outgoing=p.waitForRequest(r=>r.url().endsWith('/auth/logout')&&r.method()==='POST');
  await p.getByRole('button', { name: who.username, exact: true }).click();
  await p.getByRole('menuitem', { name: 'Log out', exact: true }).click();
  const revoked=(await outgoing).headers().authorization?.replace(/^Bearer /,'');assert(revoked,'real logout used a bearer token');
  await p.getByRole('heading', { name: /Keep great resources/ }).waitFor();
  who.token = null;
  return revoked;
}
async function postgresProof(id, selectors) {
  const connection=new URL(process.env.BOOKMARKS_TEST_DATABASE_URL);
  assert(connection.protocol.startsWith('postgresql')&&['localhost','127.0.0.1','[::1]'].includes(connection.hostname)&&connection.pathname.toLowerCase().includes('test'),'an isolated loopback test database is required');
  const output=path.join(runDir,id+'-postgres.xml');
  const result=require('node:child_process').spawnSync('uv',['run','--project','backend','--locked','pytest',...selectors,'-q','--junitxml='+output],{encoding:'utf8',timeout:120000,env:process.env});
  const safe=String(result.stdout||'')+'\n'+String(result.stderr||'');
  fs.writeFileSync(path.join(runDir,id+'-postgres.log'),safe.replace(/postgres(?:ql)?(?:\+\w+)?:\/\/\S+/g,'[redacted database URL]'),{mode:0o600});
  assert.equal(result.status,0,'isolated PostgreSQL check failed; see redacted local log');
  const xml=fs.readFileSync(output,'utf8');assert((xml.match(/<testcase(?:\s|>)/g)||[]).length>0,'no PostgreSQL assertions were collected');assert(!/<(?:skipped|failure|error)(?:\s|>)/.test(xml),'skipped or failed PostgreSQL assertions are not proof');
}
function begin(id) {
  requests = [];
  const files = ['acceptance.test.cjs', 'fixtures.cjs', 'report.cjs'].map(name => ({ path: 'tests/acceptance/bookmarks/' + name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, name))).digest('hex') }));
  state(s => { const c = s.cases.find(c => c.id === id); const version = s.active_execution_version || s.baseline; c.status = 'running'; c.executor_actual = 'playwright'; c.tested_head = version.head; c.workspace_snapshot = version.workspace_snapshot; c.attempts.push({ started_at: stamp(), kind: 'node:test + Playwright', result: 'running', test_files: files, tested_head: c.tested_head, workspace_snapshot: c.workspace_snapshot, runtime: version.server_version_evidence }); });
}
async function finish(id, status, error) {
  const current = JSON.parse(fs.readFileSync(path.join(runDir, 'state.json'), 'utf8')).cases.find(c => c.id === id);
  const suffix = '-attempt-' + current.attempts.length;
  const images = [];
  if (status === 'failed') for (const context of contexts) for (const p of context.pages()) {
    const name = id + suffix + '-failure-' + images.length + '.png';
    await p.screenshot({ path: path.join(runDir, name), fullPage: true, mask: [p.locator('input[type=password]')] }).then(() => images.push(name)).catch(() => {});
  }
  for (const context of contexts) await context.close(); contexts.clear();
  const log = id + suffix + '.json';
  atomic(path.join(runDir, log), { id, status, at: stamp(), error: error?.message, requests, screenshots: images });
  state(s => { const c = s.cases.find(c => c.id === id); c.status = status; c.reason = error?.message || null; c.evidence.push(log, ...images); Object.assign(c.attempts.at(-1), { completed_at: stamp(), result: status, error: error?.message }); });
}
async function close() { if (browser) { await clean(); await browser.close(); browser = null; } }
module.exports = { assert, base, runId, runDir, state, atomic, init, user, accounts: () => accounts, saveAccounts, api, list, all, group, bookmark, detail, clean, page, login, loaded, save, menu, groupMenu, move, logout, eventually, begin, finish, close, addButton, postgresProof };
