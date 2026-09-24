// Browser verification of the real local Docker stack. No request mocks.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const base = process.env.FRONTEND_URL || 'http://127.0.0.1:8080';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use disposable loopback stack only');
const output = process.env.BROWSER_ARTIFACTS || 'manager/runtime/evidence/browser';
fs.mkdirSync(output, { recursive: true });
const results = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  async function check(name, run, viewport = { width: 1440, height: 900 }) {
    const context = await browser.newContext({ viewport, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(base+'/')) external.push(req.url().split('?')[0]); });
    try {
      await run(page);
      assert.deepEqual(errors, [], 'uncaught browser errors');
      assert.deepEqual(external, [], 'unexpected external request');
      await page.screenshot({ path: path.join(output, name+'.png'), fullPage: true });
      results.push({ name, status: 'passed' });
    } catch (error) {
      results.push({ name, status: 'failed', message: error.message });
      await page.screenshot({ path: path.join(output, name+'-failed.png'), fullPage: true }).catch(() => {});
    } finally { await context.close(); }
  }
  async function noOverflow(page) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal viewport overflow');
  }
  await check('home-light', async page => {
    await page.goto(base); await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    const value = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--layout-max-width').trim());
    assert.equal(value, '1336px'); await noOverflow(page);
  });
  await check('theme-dark-neutral', async page => {
    await page.goto(base+'/theme');
    await page.getByRole('button', { name: /neutral/i }).click();
    await page.waitForFunction(() => document.documentElement.dataset.themePreset === 'neutral');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('switch').click(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.reload(); await page.getByRole('navigation').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('html').getAttribute('data-theme-preset'), 'neutral'); await noOverflow(page);
  });
  await check('language-switch', async page => {
    await page.goto(base); await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Switch to Chinese', exact: true }).click();
    await page.keyboard.press('Escape'); await page.reload();
    await page.waitForFunction(() => document.documentElement.lang.startsWith('zh'));
    await noOverflow(page);
  });
  await check('components-button', async page => {
    await page.goto(base+'/components/button'); await page.getByRole('heading', { name: 'Button', exact: true }).waitFor();
    assert(await page.locator('button:disabled').count() >= 1, 'disabled control example missing');
    assert(await page.locator('button[aria-busy="true"]').count() >= 1, 'loading control missing'); await noOverflow(page);
  });
  await check('dialog-keyboard', async page => {
    await page.goto(base+'/components/dialog');
    const text = JSON.parse(fs.readFileSync('frontend/src/shared/i18n/locales/en.json','utf8')).components.detail.preview.dialog.types.default.open;
    const trigger = page.getByRole('button', { name: text, exact: true });
    await trigger.click(); await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Tab');
    assert(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement)), 'focus escaped dialog');
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state:'hidden' });
    await noOverflow(page);
  });
  await check('components-navigation', async page => {
    for (const slug of ['input','tabs','switch','calendar','popover','query-composer','skeleton']) {
      const response = await page.goto(base+'/components/'+slug); assert.equal(response.status(),200);
      await page.locator('main h1').first().waitFor();
      await noOverflow(page);
    }
  });
  await check('auth-real-backend', async page => {
    const username = 'browser_'+randomUUID().replaceAll('-','').slice(0,20)+'_9f2c';
    await page.goto(base); await page.getByRole('button', { name:'Log in', exact:true }).click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Email', { exact:true }).count(),0);
    assert.equal(await dialog.getByText('Forgot password?', { exact:true }).count(),0);
    await dialog.getByRole('button', {name:'No account? Create one'}).click();
    await dialog.getByLabel('Username',{exact:true}).fill(username);
    await dialog.getByLabel('Set a password',{exact:true}).fill('BrowserPassw0rd!');
    await dialog.getByLabel('Confirm password',{exact:true}).fill('BrowserPassw0rd!');
    await dialog.getByRole('button',{name:'Create account',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:username,exact:true}).waitFor();
    await page.reload(); await page.getByRole('button',{name:username,exact:true}).click();
    assert.equal(await page.getByRole('menuitem',{name:'Change password',exact:true}).count(),0);
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('app.auth')).state);
    await page.getByRole('menuitem',{name:'Log out',exact:true}).click();
    await page.getByRole('button',{name:'Log in',exact:true}).waitFor();
    const denied = await page.request.get(base+'/api/v1/auth/me',{ headers:{Authorization:'Bearer '+session.token} });
    assert.equal(denied.status(),401,'server token was not revoked');
  });
  await check('mobile-components', async page => {
    await page.goto(base+'/components'); await page.locator('main').first().waitFor(); await noOverflow(page);
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await page.getByRole('dialog').waitFor(); await noOverflow(page);
  },{width:390,height:844});
  await browser.close();
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
  if (results.some(r=>r.status!=='passed')) process.exitCode=1;
})().catch(error=>{ console.error(error);process.exitCode=1; });
