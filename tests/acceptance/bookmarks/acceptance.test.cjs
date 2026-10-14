const test = require('node:test');
const f = require('./fixtures.cjs');
const { assert, base, api, user, page, list, all, group, bookmark, detail, eventually } = f;
const discoveryOnly = process.execArgv.includes('--test-name-pattern=^$');
const explicitCases = process.env.QA_CASE_IDS?.split(',');

function scenario(id, body, options = {}) {
  test(id, { timeout: options.timeout || 150000, skip: discoveryOnly ? 'discovery only; no case body or fixture mutations' : explicitCases && !explicitCases.includes(id) ? 'outside explicit retest selection' : false }, async t => {
    f.begin(id);
    if (options.postgres && !process.env.BOOKMARKS_TEST_DATABASE_URL) {
      await f.finish(id, 'blocked', new Error('Isolated PostgreSQL regression is required; connection is not configured.'));
      t.skip('Required PostgreSQL evidence unavailable; not a pass.'); return;
    }
    try {
      await f.init(); await f.clean();
      await body();
      await f.clean();
      await f.finish(id, 'passed');
    } catch (error) {
      await f.finish(id, 'failed', error);
      throw error;
    }
  });
}
test.after(async () => { await f.close(); });
const heading = (p, title) => p.getByRole('heading', { name: title, exact: true });
const selected = (p, title) => p.getByRole('checkbox', { name: 'Select ' + title, exact: true });
const dialog = p => p.getByRole('dialog');
async function createGroupUI(p, name) {
  await p.getByRole('button', { name: 'Create group', exact: true }).click();
  await dialog(p).getByLabel('Group name', { exact: false }).fill(name);
  await dialog(p).getByRole('button', { name: 'Create group', exact: true }).click();
  await dialog(p).waitFor({ state: 'hidden' });
}
async function search(p, text) {
  await p.getByRole('textbox', { name: 'Search bookmarks', exact: true }).fill(text);
  await p.getByRole('button', { name: 'Search', exact: true }).click();
}
async function noOverflow(p) {
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow');
}
async function deleteUI(p, title) {
  await f.menu(p, title, 'Delete bookmark');
  await dialog(p).getByRole('button', { name: 'Delete bookmark', exact: true }).click();
  await dialog(p).waitFor({ state: 'hidden' });
}
async function unknown(p, kind, committed) {
  let original;
  const endpoint = kind === 'group' ? '/api/v1/bookmark-groups' : kind === 'batch' ? '/api/v1/bookmarks/batch-move' : '/api/v1/bookmarks';
  await p.route('**' + endpoint, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    original = { key: route.request().headers()['idempotency-key'], payload: route.request().postDataJSON() };
    if (committed) { const response = await route.fetch(); assert.equal(response.status(), 200); }
    await route.abort('failed');
  });
  if (kind === 'bookmark') {
    await f.addButton(p).click();
    await dialog(p).getByLabel('Title', { exact: false }).fill('TC-unknown-' + kind);
    await dialog(p).getByLabel('Link', { exact: false }).fill(base + '/?unknown=1');
    await dialog(p).getByRole('button', { name: 'Save bookmark', exact: true }).click();
  } else if (kind === 'group') {
    await p.getByRole('button', { name: 'Create group', exact: true }).click();
    await dialog(p).getByLabel('Group name', { exact: false }).fill('TC-unknown-group');
    await dialog(p).getByRole('button', { name: 'Create group', exact: true }).click();
  } else {
    await selected(p, 'TC-unknown-batch').check();
    await p.getByRole('button', { name: 'Move 1 bookmarks', exact: true }).click();
  }
  const check = recoveryButton(p, kind);
  await check.waitFor();
  assert(original?.key, 'original operation key observed');
  if (kind === 'bookmark') assert(await dialog(p).getByRole('button', { name: 'Save bookmark', exact: true }).isDisabled());
  await p.unroute('**' + endpoint);
  return original;
}
function recoveryButton(p, kind) {
  return (kind === 'batch' ? p.getByRole('region', { name: 'Bookmark results', exact: true }) : dialog(p)).getByRole('button', { name: 'Check latest result', exact: true });
}

scenario('TC-001', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const p = await page({ viewport, query: '?group=ungrouped&q=React' });
    await heading(p, /./).count();
    await p.getByRole('button', { name: 'Log in and start saving', exact: true }).waitFor();
    const sample = p.getByRole('region', { name: 'Feature example', exact: true });
    await sample.waitFor(); assert.equal(await sample.getByRole('button').count(), 0); assert.equal(await sample.getByRole('link').count(), 0);
    assert.equal(p.qaRequests.filter(req=>/\/api\/v1\/bookmark/.test(req.endpoint)).length,0); await noOverflow(p);
  }
  for (const url of ['/foundation','/theme','/components','/components/button']) {
    const p = await page(); await p.goto(base + url); await heading(p, 'This page does not exist.').waitFor();
  }
  const p = await page(); await p.goto(base + '/'); await p.waitForURL('**/bookmarks');
  assert.equal(await p.getByRole('navigation').count(), 0);
  await p.goto(base+'/login');await p.waitForURL('**/bookmarks');await dialog(p).waitFor();const a=await user();await dialog(p).getByRole('textbox',{name:'Username',exact:true}).fill(a.username);await dialog(p).getByLabel('Password',{exact:true}).fill(a.password);await dialog(p).getByRole('button',{name:'Log in',exact:true}).click();await dialog(p).waitFor({state:'hidden'});await heading(p,'Resource bookmarks').waitFor();
  await p.goto(base+'/bookmarks?group=ungrouped&q=TC-001');const refresh=p.waitForNavigation();await p.getByRole('link',{name:'Bookmarks home',exact:true}).click();await refresh;assert.equal(new URL(p.url()).pathname,'/bookmarks');assert.equal(new URL(p.url()).searchParams.get('q'),'TC-001');
});

scenario('TC-002', async () => {
  const a = f.accounts().a;
  const p = await page({ query: '?group=ungrouped&q=React' });
  await p.getByRole('button', { name: 'Log in and start saving', exact: true }).click();
  await dialog(p).getByRole('button', { name: 'Close', exact: true }).click();
  assert(new URL(p.url()).searchParams.get('q') === 'React');
  await p.getByRole('button', { name: 'Log in and start saving', exact: true }).click();
  if (!a.registered) {
    await dialog(p).getByRole('button', { name: 'No account? Create one', exact: true }).click();
    await dialog(p).getByLabel('Username', { exact: true }).fill(a.username);
    await dialog(p).getByLabel('Set a password', { exact: true }).fill(a.password);
    await dialog(p).getByLabel('Confirm password', { exact: true }).fill(a.password);
    const responsePromise = p.waitForResponse(r => r.url().endsWith('/auth/register') && r.request().method() === 'POST');
    await dialog(p).getByRole('button', { name: 'Create account', exact: true }).click();
    const response = await responsePromise; assert.equal(response.status(), 200);
    a.id = (await response.json()).data.id; a.registered = true; f.saveAccounts();
    await dialog(p).waitFor({ state: 'hidden' });
  }
  // Successful registration uses the existing auth session composition; inspect before acting.
  if (await dialog(p).count()) {
    await dialog(p).getByRole('textbox', { name: 'Username', exact: true }).fill(a.username);
    await dialog(p).getByLabel('Password', { exact: true }).fill(a.password);
    await dialog(p).getByRole('button', { name: 'Log in', exact: true }).click();
  }
  await heading(p, 'Resource bookmarks').waitFor();
  assert.equal(new URL(p.url()).searchParams.get('group'), 'ungrouped'); assert.equal(new URL(p.url()).searchParams.get('q'), 'React');
  await user(); await bookmark(a, 'TC-002 retained');
  const revoked=await f.logout(p, a);await api({token:revoked},'/auth/me',undefined,{status:401});await f.login(p, await user());
  assert((await all(a)).some(x => x.title === 'TC-002 retained'));
});

scenario('TC-003', async () => {
  const a = await user(); const gid = await group(a, 'TC-003 group'); const p = await page({ who: a });
  await f.save(p, { title: 'TC-003 first', url: base + '/?duplicate=1' });
  await f.save(p, { title: 'TC-003 second', url: base + '/?duplicate=1' });
  await f.save(p, { title: 'TC-003 grouped', groupName: 'TC-003 group', note: 'line one\nline two' });
  const items = await all(a); assert.equal(items.length, 3); assert.equal(items.filter(x => x.group_id === null).length, 2);
  const grouped = items.find(x => x.group_id === gid); assert.equal(grouped.note, 'line one\nline two');
});

scenario('TC-004', async () => {
  const a = await user(); const p = await page({ who: a });
  await f.addButton(p).click();
  await dialog(p).getByLabel('Note', { exact: false }).fill('keep my draft');
  await dialog(p).getByLabel('Link', { exact: false }).fill('invalid');
  await dialog(p).getByRole('button', { name: 'Save bookmark', exact: true }).click();
  assert.equal(await dialog(p).getByLabel('Title', { exact: false }).getAttribute('aria-invalid'), 'true');
  assert.equal(await dialog(p).getByLabel('Note', { exact: false }).inputValue(), 'keep my draft');
  const valid = { title: '😀'.repeat(80), url: 'http://127.0.0.1:8080/' + 'x'.repeat(2048 - 'http://127.0.0.1:8080/'.length), note: '😀'.repeat(500) };
  await api(a, '/bookmarks', valid); assert.equal((await all(a))[0].title.length, 160);
  for (const data of [{title:' '},{title:'a'.repeat(81)},{url:''},{url:'ftp://example.com'},{url:'https://x/'+'a'.repeat(2049)},{note:'a'.repeat(501)}]) {
    await api(a, '/bookmarks', {title:'TC-004',url:'https://unreachable.invalid/resource',note:'',...data}, {status:422});
  }
  for (const url of ['http://127.0.0.1:1/unreachable','https://unreachable.invalid/resource']) await api(a, '/bookmarks', { title: ' TC-004 valid ', url });
  const invalidUi = [
    ['Title', ' '], ['Title', '😀'.repeat(81)], ['Link', ''],
    ['Link', 'ftp://example.com'], ['Link', base + '/' + 'x'.repeat(2049)], ['Note', '😀'.repeat(501)],
  ];
  for (const [field, value] of invalidUi) {
    await dialog(p).getByLabel('Title',{exact:false}).fill('TC-004 UI retained');
    await dialog(p).getByLabel('Link',{exact:false}).fill(base+'/');
    await dialog(p).getByLabel('Note',{exact:false}).fill('retained note');
    await dialog(p).getByLabel(field,{exact:false}).fill(value);
    await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).click();
    const invalid=dialog(p).getByLabel(field,{exact:false});
    assert.equal(await invalid.getAttribute('aria-invalid'),'true'); assert(await invalid.getAttribute('aria-describedby'));
    if(field!=='Title')assert.equal(await dialog(p).getByLabel('Title',{exact:false}).inputValue(),'TC-004 UI retained');
    if(field!=='Note')assert.equal(await dialog(p).getByLabel('Note',{exact:false}).inputValue(),'retained note');
  }
  await dialog(p).getByLabel('Title',{exact:false}).fill(valid.title);
  await dialog(p).getByLabel('Link',{exact:false}).fill(valid.url);
  await dialog(p).getByLabel('Note',{exact:false}).fill(valid.note);
  await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).click();await dialog(p).waitFor({state:'hidden'});
  await f.addButton(p).click();
  await dialog(p).getByLabel('Title', { exact: false }).fill('界');
  await dialog(p).getByLabel('Link', { exact: false }).fill(base + '/?fixed=1');
  await dialog(p).getByRole('button', { name: 'Save bookmark', exact: true }).click(); await dialog(p).waitFor({state:'hidden'});
  assert((await all(a)).some(row=>row.title==='界'&&row.note===''));
});

scenario('TC-005', async () => {
  const a=await user(), gid=await group(a,'TC-005 group'), target=await group(a,'TC-005 target'), id=await bookmark(a,'TC-005 old',gid,{note:'original\nnotes'}), p=await page({who:a});
  await f.menu(p,'TC-005 old','Edit bookmark');
  assert.equal(await dialog(p).getByLabel('Note',{exact:false}).inputValue(),'original\nnotes');
  await dialog(p).getByLabel('Title',{exact:false}).fill('cancelled'); await dialog(p).getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal((await detail(a,id)).title,'TC-005 old');await p.reload();await heading(p,'TC-005 old').waitFor();
  await f.menu(p,'TC-005 old','Edit bookmark'); await f.save(p,{title:'TC-005 new',url:base+'/?edited=1',groupName:'TC-005 target',note:'changed'},true);
  const result=await detail(a,id);assert.equal(result.note,'changed');assert.equal(result.group_id,target);assert.equal(result.url,base+'/?edited=1');await f.logout(p,a); await f.login(p,await user()); await heading(p,'TC-005 new').waitFor();
});

scenario('TC-006', async () => {
  const a=await user(),g=await group(a,'TC-006 group'); await bookmark(a,'TC-006 delete',g); await bookmark(a,'TC-006 keep',g); const p=await page({who:a});
  await f.menu(p,'TC-006 delete','Delete bookmark'); await dialog(p).getByText('Deletion cannot be undone.',{exact:true}).waitFor();
  await dialog(p).getByText('TC-006 delete',{exact:true}).waitFor(); await dialog(p).getByRole('button',{name:'Cancel',exact:true}).click(); assert.equal((await list(a)).all_count,2);
  await deleteUI(p,'TC-006 delete'); assert.equal((await list(a)).all_count,1); assert.equal((await list(a)).groups.length,1);
});

scenario('TC-007', async () => {
  const a=await user(); await bookmark(a,'TC-007 noted',null,{note:'first\nsecond',url:'http://127.0.0.1:8000/health?qa='+f.runId}); await bookmark(a,'TC-007 blank'); const p=await page({who:a,query:'?group=ungrouped'});
  await p.getByRole('button',{name:'View note for TC-007 noted',exact:true}).click(); await dialog(p).getByText('first\nsecond',{exact:true}).waitFor(); await dialog(p).getByRole('button',{name:'Close',exact:true}).click();
  await p.getByRole('button',{name:'View note for TC-007 blank',exact:true}).click(); await dialog(p).getByText('No note yet.',{exact:true}).waitFor(); await dialog(p).getByRole('button',{name:'Close',exact:true}).click();
  const before=p.url(); const link=p.getByRole('link',{name:'Open TC-007 noted in a new tab',exact:true}); assert((await link.getAttribute('rel')).includes('noopener'));
  const popupPromise=p.waitForEvent('popup'); await link.click(); const popup=await popupPromise; await popup.waitForLoadState(); assert(popup.url().includes('/health?qa=')); assert.equal(p.url(),before); await popup.close();
});

scenario('TC-008', async () => { await f.postgresProof('TC-008',[
  'backend/tests/test_bookmarks_postgres.py::test_real_search_stable_sort_and_full_group_snapshot_cost',
  'backend/tests/test_bookmark_batch_postgres.py::test_batch_timestamps_stable_order_noop_and_sorted_hash_replay',
  'backend/tests/test_bookmark_groups_postgres.py::test_http_m1_to_group_management_lifecycle_with_real_auth',
]); }, {postgres:true});

scenario('TC-009', async () => {
  const a=await user(); for(let i=0;i<11;i++) await bookmark(a,'TC-009 '+i); const p=await page({who:a});
  assert.equal(await p.getByRole('checkbox',{name:/^Select TC-009/}).count(),10); await p.getByRole('button',{name:'Next',exact:true}).click(); await p.getByText('Page 2 / 2 · 11 bookmarks',{exact:true}).waitFor();
  const item=(await list(a,'?page=2')).list[0]; await deleteUI(p,item.title); await p.getByText('Page 1 / 1 · 10 bookmarks',{exact:true}).waitFor();
});

scenario('TC-010', async () => {
  const a=await user(); await bookmark(a,'TC-010 ReAcT %_'); await bookmark(a,'TC-010 url',null,{url:base+'/react-path'}); await bookmark(a,'TC-010 note',null,{note:'react'}); const p=await page({who:a});
  await search(p,'  REACT  '); await eventually(async()=>assert.equal(await p.getByRole('checkbox',{name:/^Select TC-010/}).count(),2));
  await search(p,'%_'); await eventually(async()=>assert.equal(await p.getByRole('checkbox',{name:/^Select TC-010/}).count(),1));
  assert.equal((await list(a,'?q='+encodeURIComponent('%_'))).total,1);
  await bookmark(a,'TC-010 back\\slash');await bookmark(a,'TC-010 note-only',null,{note:'private-note-keyword'});
  await search(p,'private-note-keyword');await heading(p,'No matching bookmarks').waitFor();
  await search(p,'back\\slash');await heading(p,'TC-010 back\\slash').waitFor();assert.equal((await list(a,'?q='+encodeURIComponent('back\\slash'))).total,1);
});

scenario('TC-011', async () => {
  const a=await user(), g=await group(a,'TC-011 group'), second=await group(a,'TC-011 second'); for(let i=0;i<11;i++) { await bookmark(a,'TC-011 React '+i,g); await bookmark(a,'TC-011 React second '+i,second); } await bookmark(a,'TC-011 other');
  const p=await page({who:a,query:'?group='+g+'&page=2'}); await search(p,'React 1');
  await eventually(()=>{assert.equal(new URL(p.url()).searchParams.get('page'),null);});
  await eventually(async()=>assert.equal(await p.getByRole('checkbox',{name:/^Select TC-011/}).count(),2));
  assert.equal((await list(a,'?group='+g+'&q=React%201')).groups.find(x=>x.id===g).count,11);
  await p.getByRole('button',{name:'Clear keywords',exact:true}).click(); await eventually(async()=>assert.equal(await p.getByRole('checkbox',{name:/^Select TC-011/}).count(),10));
  await p.getByRole('button',{name:'All bookmarks 23',exact:true}).click(); assert.equal((await list(a)).total,23);
  await search(p,'React');await p.getByRole('button',{name:'Next',exact:true}).click();await p.getByText('Page 2 / 3 · 22 bookmarks',{exact:true}).waitFor();
  await p.getByRole('button',{name:'TC-011 second 11',exact:true}).click();await p.getByText('Page 1 / 2 · 11 bookmarks',{exact:true}).waitFor();assert.equal(new URL(p.url()).searchParams.get('q'),'React');
});

scenario('TC-012', async () => {
  const a=await user();for(let i=0;i<11;i++)await bookmark(a,'TC-012 '+i);const p=await page({who:a});await selected(p,'TC-012 10').check();let release;const held=new Promise(r=>release=r);await p.route('**/api/v1/bookmarks?*',async route=>{if(new URL(route.request().url()).searchParams.get('page')==='2')await held;await route.continue();});await p.getByRole('button',{name:'Next',exact:true}).click();await p.getByRole('status',{name:'Loading bookmarks…',exact:true}).waitFor();assert.equal(await selected(p,'TC-012 10').count(),0);assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);release();await p.unrouteAll({behavior:'wait'});await p.getByText('Page 2 / 2 · 11 bookmarks',{exact:true}).waitFor();
  assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);await p.reload();assert.equal(new URL(p.url()).searchParams.get('page'),'2');await p.goBack();await p.getByText('Page 1 / 2 · 11 bookmarks',{exact:true}).waitFor();assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);
  await selected(p,'TC-012 10').check();await search(p,'TC-012');await eventually(async()=>assert.equal(await p.getByRole('checkbox',{name:/^Select TC-012/}).count(),10));assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);await selected(p,'TC-012 10').check();await p.getByRole('button',{name:'Ungrouped 11',exact:true}).click();await eventually(()=>assert.equal(new URL(p.url()).searchParams.get('group'),'ungrouped'));assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);await p.goBack();await p.getByText('Page 1 / 2 · 11 bookmarks',{exact:true}).waitFor();assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);await p.goForward();await eventually(()=>assert.equal(new URL(p.url()).searchParams.get('group'),'ungrouped'));assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);
});

scenario('TC-013', async () => {
  const a=await user(),b=await user('b'),p=await page({who:a});await createGroupUI(p,'TC-013 Empty');assert.equal((await list(a)).groups[0].count,0);
  for(const name of [' ','全部','未分组','a'.repeat(31),'tc-013 empty']) await api(a,'/bookmark-groups',{name},{status:name.toLowerCase()==='tc-013 empty'?409:422});
  await group(a,'x');await group(a,'😀'.repeat(30));await group(b,'TC-013 Empty');
  assert.equal(await p.getByRole('button',{name:/Actions for group All bookmarks|Actions for group Ungrouped/}).count(),0);
});

scenario('TC-014', async () => {
  const a=await user(),g=await group(a,'TC-014 old');await bookmark(a,'TC-014 one',g);await bookmark(a,'TC-014 two',g);const before=await all(a),p=await page({who:a});
  await f.groupMenu(p,'TC-014 old','Rename group');await dialog(p).getByLabel('Group name',{exact:false}).fill('cancelled');await dialog(p).getByRole('button',{name:'Cancel',exact:true}).click();
  await f.groupMenu(p,'TC-014 old','Rename group');await dialog(p).getByLabel('Group name',{exact:false}).fill('TC-014 new');await dialog(p).getByRole('button',{name:'Save name',exact:true}).click();await dialog(p).waitFor({state:'hidden'});
  assert.deepEqual((await all(a)).map(x=>[x.id,x.group_id,x.updated_at]),before.map(x=>[x.id,x.group_id,x.updated_at]));assert.equal((await list(a)).groups[0].name,'TC-014 new');
  await f.menu(p,'TC-014 one','Edit bookmark');await dialog(p).getByRole('combobox',{name:'Group',exact:false}).click();await p.getByRole('option',{name:'TC-014 new',exact:true}).waitFor();await p.keyboard.press('Escape');await dialog(p).getByRole('button',{name:'Cancel',exact:true}).click();
  await p.setViewportSize({width:390,height:844});await p.getByRole('combobox',{name:'Bookmark groups',exact:true}).click();await p.getByRole('option',{name:'TC-014 new · 2',exact:true}).waitFor();await p.keyboard.press('Escape');
});

scenario('TC-015', async () => { await f.postgresProof('TC-015',[
  'backend/tests/test_bookmark_groups_postgres.py::test_http_m1_to_group_management_lifecycle_with_real_auth',
  'backend/tests/test_bookmark_groups_postgres.py::test_group_delete_midway_failure_rolls_back_all_transfers',
  'backend/tests/test_bookmark_groups_postgres.py::test_group_delete_and_bookmark_write_share_lock_in_both_orders',
]); }, {postgres:true});

scenario('TC-016', async () => {
  const a=await user(),g=await group(a,'TC-016 group');await bookmark(a,'TC-016 one',g);const p=await page({who:a});await f.groupMenu(p,'TC-016 group','Delete group');
  await bookmark(a,'TC-016 concurrent',g);await dialog(p).getByRole('button',{name:'Delete group',exact:true}).click();
  await dialog(p).getByText(/number of bookmarks has changed|latest impact is shown/i).first().waitFor();assert.equal((await list(a)).all_count,2);assert.equal((await list(a)).groups.length,1);
  const refresh=dialog(p).getByRole('button',{name:'Refresh deletion impact',exact:true});if(await refresh.count())await refresh.click();
  await dialog(p).getByText(/latest impact is shown/i).waitFor();await dialog(p).getByRole('button',{name:'Delete group',exact:true}).click();await dialog(p).waitFor({state:'hidden'});assert.equal((await list(a)).groups.length,0);assert.equal((await list(a)).ungrouped_count,2);
});

scenario('TC-017', async () => {
  const a=await user();for(let i=0;i<11;i++)await bookmark(a,'TC-017 '+i);const p=await page({who:a});await p.getByRole('checkbox',{name:'Select current page (10)',exact:true}).check();
  assert.equal(await p.getByRole('checkbox',{name:/^Select TC-017/}).evaluateAll(xs=>xs.filter(x=>x.checked).length),10);await selected(p,'TC-017 10').uncheck();
  assert.equal(await p.getByRole('checkbox',{name:'Select current page (10)',exact:true}).evaluate(x=>x.indeterminate),true);
  await p.getByRole('button',{name:'Cancel selection',exact:true}).click();assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);assert.equal((await list(a)).all_count,11);
});

scenario('TC-018', async () => { await f.postgresProof('TC-018',['backend/tests/test_bookmark_batch_postgres.py']); }, {postgres:true});

scenario('TC-019', async () => {
  const a=await user(),g=await group(a,'TC-019 source');await group(a,'TC-019 target');for(let i=0;i<11;i++)await bookmark(a,'TC-019 '+i,g);const p=await page({who:a,query:'?group='+g+'&page=2'});
  await p.getByText('Page 2 / 2 · 11 bookmarks',{exact:true}).waitFor();await selected(p,'TC-019 0').check();await f.move(p,1,'TC-019 target');await p.getByText('Page 1 / 1 · 10 bookmarks',{exact:true}).waitFor();assert.equal((await list(a)).groups.find(x=>x.id===g).count,10);
});

scenario('TC-020', async () => {
  const a=await user(),g=await group(a,'TC-020 target'),x=await bookmark(a,'TC-020 removed'),y=await bookmark(a,'TC-020 kept');const p=await page({who:a});await selected(p,'TC-020 removed').check();await selected(p,'TC-020 kept').check();
  await api(a,'/bookmarks/'+x,undefined,{method:'DELETE'});await p.getByRole('combobox',{name:'Move to group',exact:true}).click();await p.getByRole('option',{name:'TC-020 target',exact:true}).click();await p.getByRole('button',{name:'Move 2 bookmarks',exact:true}).click();
  await p.getByText(/bookmark or target group is unavailable/i).waitFor();assert.equal((await detail(a,y)).group_id,null);await eventually(async()=>assert(await selected(p,'TC-020 kept').isChecked()));
  await f.move(p,1,'TC-020 target');assert.equal((await detail(a,y)).group_id,g);
  const doomed=await group(a,'TC-020 doomed'),x2=await bookmark(a,'TC-020 target-source-1'),y2=await bookmark(a,'TC-020 target-source-2');await p.reload();await selected(p,'TC-020 target-source-1').check();await selected(p,'TC-020 target-source-2').check();
  await p.getByRole('combobox',{name:'Move to group',exact:true}).click();await p.getByRole('option',{name:'TC-020 doomed',exact:true}).click();await api(a,'/bookmark-groups/'+doomed+'?expected_count=0',undefined,{method:'DELETE'});await p.getByRole('button',{name:'Move 2 bookmarks',exact:true}).click();
  await p.getByText(/bookmark or target group is unavailable/i).waitFor();assert.equal((await detail(a,x2)).group_id,null);assert.equal((await detail(a,y2)).group_id,null);await eventually(async()=>assert(await selected(p,'TC-020 target-source-1').isChecked()));await f.move(p,2,'TC-020 target');assert.equal((await detail(a,x2)).group_id,g);assert.equal((await detail(a,y2)).group_id,g);
});

scenario('TC-021', async () => {
  const a=await user(),b=await user('b'),g=await group(a,'TC-021 A'),id=await bookmark(a,'TC-021 secret',g),bid=await bookmark(b,'TC-021 B');
  await api(b,'/bookmarks/'+id,undefined,{status:404});await api(b,'/bookmarks/'+id,{title:'hacked',url:base+'/'},{method:'PUT',status:404});await api(b,'/bookmarks/'+id,undefined,{method:'DELETE',status:404});
  await api(b,'/bookmark-groups/'+g,{name:'hacked'},{method:'PATCH',status:404});await api(b,'/bookmark-groups/'+g+'?expected_count=1',undefined,{method:'DELETE',status:404});
  await api(b,'/bookmarks',{title:'TC-021 foreign target',url:base+'/',group_id:g},{status:404});await api(b,'/bookmarks/'+bid,{title:'TC-021 B',url:base+'/',group_id:g},{method:'PUT',status:404});
  await api(b,'/bookmarks/batch-move',{bookmark_ids:[bid,id],target_group_id:null},{status:409});await api(b,'/bookmarks/batch-move',{bookmark_ids:[bid],target_group_id:g},{status:409});
  const key=require('node:crypto').randomUUID();await api(a,'/bookmarks',{title:'TC-021 receipt',url:base+'/'},{key});const hidden=(await api(b,'/bookmark-operations/'+key+'/resolve',{})).data;assert.equal(hidden.status,'not_executed');assert.equal(hidden.resource_id,null);
  assert.equal((await detail(a,id)).title,'TC-021 secret');assert.equal((await detail(b,bid)).group_id,null);assert((await all(b)).every(x=>!x.title.includes('secret')));
});

scenario('TC-022', async () => {
  const a=await user(),b=await user('b');await bookmark(a,'TC-022 private A');await bookmark(b,'TC-022 private B');const p=await page({who:a});let release;const held=new Promise(r=>release=r);
  await p.route('**/api/v1/bookmarks?*',async route=>{const response=await route.fetch();await held;await route.fulfill({response});});
  await search(p,'private');await f.logout(p,a);await f.login(p,b);release();await p.unrouteAll({behavior:'wait'});
  await heading(p,'TC-022 private B').waitFor();assert.equal(await heading(p,'TC-022 private A').count(),0);assert.equal(await p.getByRole('group',{name:'Batch bookmark move'}).count(),0);
  const writer=await page({who:await user()});let releaseWrite,writeStarted=false;const writeHeld=new Promise(r=>releaseWrite=r);
  await writer.route('**/api/v1/bookmarks',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();writeStarted=true;await writeHeld;await route.fulfill({response});});
  await f.addButton(writer).click();await dialog(writer).getByLabel('Title',{exact:false}).fill('TC-022 late A write');await dialog(writer).getByLabel('Link',{exact:false}).fill(base+'/');await dialog(writer).getByRole('button',{name:'Save bookmark',exact:true}).click();await eventually(()=>assert(writeStarted));
  await dialog(writer).getByRole('button',{name:'Close',exact:true}).click();await f.logout(writer,a);await f.login(writer,await user('b'));releaseWrite();await writer.unrouteAll({behavior:'wait'});
  await heading(writer,'TC-022 private B').waitFor();assert.equal(await heading(writer,'TC-022 late A write').count(),0);assert.equal(await dialog(writer).count(),0);assert.equal(await writer.getByRole('button',{name:'Check latest result',exact:true}).count(),0);assert.equal(await writer.getByRole('button',{name:'Return to draft',exact:true}).count(),0);assert.equal((await list(await user('b'))).all_count,1);assert((await all(await user())).some(x=>x.title==='TC-022 late A write'));
});

scenario('TC-023', async () => {
  const a=await user(),p=await page({who:a});await heading(p,'No bookmarks yet').waitFor();await p.getByRole('region',{name:'Bookmark results'}).getByRole('button',{name:'Add bookmark',exact:true}).click();await dialog(p).getByRole('button',{name:'Cancel',exact:true}).click();await bookmark(a,'TC-023 elsewhere');const g=await group(a,'TC-023 empty');await p.goto(base+'/bookmarks?group='+g);await heading(p,'This group has no bookmarks').waitFor();
  await p.getByRole('region',{name:'Bookmark results'}).getByRole('button',{name:'Add bookmark',exact:true}).click();await dialog(p).getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(new URL(p.url()).searchParams.get('group'),g);
  await p.goto(base+'/bookmarks?q=no-match');await heading(p,'No matching bookmarks').waitFor();await heading(p,'No matching bookmarks').locator('..').getByRole('button',{name:'Clear keywords',exact:true}).click();await heading(p,'TC-023 elsewhere').waitFor();
  let release;const held=new Promise(r=>release=r);await p.route('**/api/v1/bookmarks*',async route=>{await held;await route.continue();});const nav=p.reload();await p.getByText('Loading bookmarks…',{exact:true}).waitFor();assert.equal(await heading(p,'No bookmarks yet').count(),0);release();await nav;await p.unrouteAll({behavior:'wait'});
});

scenario('TC-024', async () => {
  const a=await user(),p=await page({who:a});await p.route('**/api/v1/bookmarks*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:50300,message:'test-injected dependency unavailable',data:null})}));await p.reload();await p.getByText('Could not load bookmarks. Check your connection and try again.',{exact:true}).waitFor();
  await p.unrouteAll();await p.getByRole('button',{name:'Reload',exact:true}).click();await heading(p,'No bookmarks yet').waitFor();
});

scenario('TC-025', async () => {
  const a=await user();await bookmark(a,'TC-025 existing');const p=await page({who:a});await heading(p,'TC-025 existing').waitFor();let deny=true;
  await p.route('**/api/v1/bookmarks*',route=>route.request().method()==='GET'&&deny?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:50300,message:'injected list fault',data:null})}):route.continue());
  deny=false;const cachedQuery=p.waitForResponse(r=>r.url().includes('/api/v1/bookmarks?')&&new URL(r.url()).searchParams.get('q')==='existing');await search(p,'existing');assert.equal((await cachedQuery).status(),200);await heading(p,'TC-025 existing').waitFor();deny=true;
  const failedRefresh=p.waitForResponse(r=>r.url().includes('/api/v1/bookmarks')&&r.request().method()==='GET'&&r.status()===503);await p.getByRole('button',{name:'Clear keywords',exact:true}).click();await failedRefresh;await p.getByText('The list could not be updated. Previously loaded bookmarks are still shown.',{exact:true}).waitFor();await heading(p,'TC-025 existing').waitFor();deny=false;await p.getByRole('button',{name:'Reload',exact:true}).click();await p.getByRole('alert').waitFor({state:'hidden'});
  p.on('response',r=>{if(r.url().endsWith('/api/v1/bookmarks')&&r.request().method()==='POST'&&r.status()===200)deny=true;});
  await f.save(p,{title:'TC-025 saved'});await p.getByText('Operation completed, but the list has not updated. Reload to see the latest result.',{exact:true}).waitFor();await heading(p,'TC-025 existing').waitFor();
  assert.equal((await list(a)).all_count,2);await p.unrouteAll();await p.reload();await heading(p,'TC-025 saved').waitFor();
});

scenario('TC-026', async () => {
  const a=await user(),p=await page({who:a});let posts=0;let release;const held=new Promise(r=>release=r);
  await p.getByRole('button',{name:'Create group',exact:true}).click();await dialog(p).getByLabel('Group name',{exact:false}).fill('TC-026 racing name');await group(a,'TC-026 racing name');
  const duplicateResponse=p.waitForResponse(r=>r.url().endsWith('/bookmark-groups')&&r.request().method()==='POST');await dialog(p).getByRole('button',{name:'Create group',exact:true}).click();assert.equal((await duplicateResponse).status(),409);await eventually(async()=>assert.equal(await dialog(p).getByLabel('Group name',{exact:false}).getAttribute('aria-invalid'),'true'));assert.equal(await dialog(p).getByLabel('Group name',{exact:false}).inputValue(),'TC-026 racing name');assert(await dialog(p).getByRole('button',{name:'Create group',exact:true}).isEnabled());
  await dialog(p).getByLabel('Group name',{exact:false}).fill('TC-026 corrected');await dialog(p).getByRole('button',{name:'Create group',exact:true}).click();await dialog(p).waitFor({state:'hidden'});
  await p.route('**/api/v1/bookmarks',async route=>{if(route.request().method()==='POST'){posts++;await held;}await route.continue();});
  await f.addButton(p).click();await dialog(p).getByLabel('Title',{exact:false}).fill('TC-026 pending');await dialog(p).getByLabel('Link',{exact:false}).fill(base+'/');
  await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).click();await eventually(()=>assert.equal(posts,1));await p.keyboard.press('Enter');assert.equal(posts,1);release();await dialog(p).waitFor({state:'hidden'});await p.unrouteAll({behavior:'wait'});assert.equal((await list(a)).all_count,1);
  const key=require('node:crypto').randomUUID(),payload={title:'TC-026 replay',url:base+'/'};const first=await api(a,'/bookmarks',payload,{key});assert.deepEqual((await api(a,'/bookmarks',payload,{key})).data,first.data);await api(a,'/bookmarks',{...payload,title:'different'},{key,status:409});assert.equal((await list(a)).all_count,2);
});

scenario('TC-027', async () => {
  for(const kind of ['bookmark','group','batch']){
    await f.clean();const a=await user();if(kind==='batch')await bookmark(a,'TC-unknown-batch',await group(a,'TC-unknown-source'));const p=await page({who:a});const original=await unknown(p,kind,true);
    assert(await p.getByRole('heading',{name:'Resource bookmarks',exact:true,includeHidden:true}).locator('..').getByRole('button',{name:'Add bookmark',exact:true,includeHidden:true}).isDisabled());let resolvedKey;p.on('request',r=>{const match=r.url().match(/bookmark-operations\/([^/]+)\/resolve/);if(match)resolvedKey=match[1];});
    if(kind==='group'){await p.reload();await p.getByRole('button',{name:'Check latest result',exact:true}).click();}else await recoveryButton(p,kind).click();await eventually(async()=>assert.equal(await p.getByRole('button',{name:'Check latest result',exact:true}).count(),0));assert.equal(resolvedKey,original.key);
    const outcome=(await api(a,'/bookmark-operations/'+original.key+'/resolve',{})).data;assert.equal(outcome.status,'succeeded');
    await p.reload();assert.equal(await p.getByRole('button',{name:'Check latest result',exact:true}).count(),0);if(kind==='bookmark')assert.equal((await list(a)).all_count,1);if(kind==='group')assert.equal((await list(a)).groups.length,1);if(kind==='batch')assert.equal((await all(a))[0].group_id,null);
  }
});

scenario('TC-028', async () => {
  for(const kind of ['bookmark','group','batch']){
    await f.clean();const a=await user();if(kind==='batch')await bookmark(a,'TC-unknown-batch',await group(a,'TC-unknown-source'));const before=await all(a),p=await page({who:a});const original=await unknown(p,kind,false);
    await recoveryButton(p,kind).click();await eventually(async()=>assert.equal((await api(a,'/bookmark-operations/'+original.key+'/resolve',{})).data.status,'not_executed'));
    const endpoint=kind==='group'?'/bookmark-groups':kind==='batch'?'/bookmarks/batch-move':'/bookmarks';await api(a,endpoint,original.payload,{key:original.key,status:409});assert.deepEqual(await all(a),before);
  }
});

scenario('TC-029', async () => {
  const matrix=[],hitFailures=[];
  for(const viewport of [{width:390,height:844},{width:390,height:520}])for(const theme of ['light','dark'])for(const locale of ['en','zh']){
    await f.clean();const a=await user(),p=await page({who:a,viewport,theme});
    if(locale==='zh'){await p.getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('button',{name:'Switch to Chinese',exact:true}).click();await p.keyboard.press('Escape');}
    const b=require(`../../../frontend/src/shared/i18n/locales/${locale}.json`).bookmarks;
    const fmt=(key,variables={})=>b[key].replace(/\{\{(\w+)\}\}/g,(_,name)=>String(variables[name]));
    const button=(key,scope=p)=>scope.getByRole('button',{name:b[key],exact:true});
    const add=heading(p,b.heading).locator('..').getByRole('button',{name:b.add,exact:true});
    const confirm=async key=>{const target=button(key,dialog(p));await target.scrollIntoViewIfNeeded();const r=await target.boundingBox();assert(r.y>=0&&r.y+r.height<=viewport.height+1,'dialog footer is clipped');if(r.height<44||r.width<44){hitFailures.push({viewport,theme,locale,action:b[key],bounds:r});if(hitFailures.length===1)await p.screenshot({path:require('node:path').join(f.runDir,'TC-029-mobile-action-hit.png')});}await target.click();await dialog(p).waitFor({state:'hidden'});};
    const manage=async key=>{await button('manageGroups').click();await p.getByRole('menuitem',{name:b[key],exact:true}).click();};
    const chooseGroup=async name=>{await p.getByRole('combobox',{name:b.groupsLabel,exact:true}).click();await p.getByRole('option',{name:new RegExp('^'+name+'[ ·]')}).click();};
    await add.click();await dialog(p).getByLabel(b.titleField,{exact:false}).fill('TC-029 mobile');await dialog(p).getByLabel(b.urlField,{exact:false}).fill(base+'/?mobile=1');await dialog(p).getByLabel(b.noteField,{exact:false}).fill('mobile\nlong note');await noOverflow(p);await confirm('save');
    await manage('createGroup');await dialog(p).getByLabel(b.groupName,{exact:false}).fill('TC-029 mobile group');await confirm('createGroup');
    await p.getByRole('checkbox',{name:fmt('selectBookmark',{title:'TC-029 mobile'}),exact:true}).check();await p.getByRole('combobox',{name:b.moveTarget,exact:true}).click();await p.getByRole('option',{name:'TC-029 mobile group',exact:true}).click();await p.getByRole('button',{name:fmt('moveCount',{count:1}),exact:true}).click();await p.getByRole('group',{name:b.batchControls,exact:true}).waitFor({state:'hidden'});
    await p.getByRole('button',{name:fmt('moreActions',{title:'TC-029 mobile'}),exact:true}).click();await p.getByRole('menuitem',{name:b.edit,exact:true}).click();const longTitle=(locale==='zh'?'资料':'resource').repeat(locale==='zh'?40:10);await dialog(p).getByLabel(b.titleField,{exact:false}).fill(longTitle);await dialog(p).getByLabel(b.noteField,{exact:false}).fill('x'.repeat(500));await noOverflow(p);await confirm('saveChanges');
    await p.getByRole('textbox',{name:b.searchLabel,exact:true}).fill(longTitle);await button('search').click();await heading(p,longTitle).waitFor();
    await p.getByRole('button',{name:fmt('viewNote',{title:longTitle}),exact:true}).click();await dialog(p).getByText('x'.repeat(500),{exact:true}).waitFor();await noOverflow(p);await button('close',dialog(p)).click();
    await chooseGroup('TC-029 mobile group');await manage('renameGroup');await dialog(p).getByLabel(b.groupName,{exact:false}).fill('TC-029 renamed');await confirm('saveGroupName');
    await manage('deleteGroup');await dialog(p).getByText(b.deleteGroupDescription,{exact:true}).waitFor();await confirm('deleteGroup');await eventually(()=>assert.equal(new URL(p.url()).searchParams.get('group'),'ungrouped'));assert.equal(new URL(p.url()).searchParams.get('q'),longTitle);assert.equal((await list(a)).all_count,1);
    await p.getByRole('button',{name:fmt('moreActions',{title:longTitle}),exact:true}).click();await p.getByRole('menuitem',{name:b.delete,exact:true}).click();await noOverflow(p);await confirm('delete');assert.equal((await list(a)).all_count,0);await noOverflow(p);
    matrix.push({viewport,theme,locale,flow_result:'passed'});f.atomic(require('node:path').join(f.runDir,'TC-029-matrix.json'),matrix);
  }
  f.atomic(require('node:path').join(f.runDir,'TC-029-hit-areas.json'),hitFailures);assert.equal(hitFailures.length,0,'Mobile dialog actions are smaller than the required 44px: '+JSON.stringify(hitFailures));
},{timeout:300000});

scenario('TC-030', async () => {
  const a=await user();await bookmark(a,'TC-030 '+ '资料'.repeat(35),null,{note:'note'.repeat(125)});
  const p=await page({who:a});await p.getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('switch').click();await p.keyboard.press('Escape');await p.reload();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');
  await p.getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('button',{name:/Switch to.*Chinese/i}).click();await p.keyboard.press('Escape');await p.reload();await heading(p,'资源收藏夹').waitFor();
  for(const width of [1024,1280,1440,1920]){await p.setViewportSize({width,height:900});await noOverflow(p);}
  await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());await p.reload();await heading(p,'资源收藏夹').waitFor();await noOverflow(p);
});

scenario('TC-031', async () => {
  const a=await user();await group(a,'TC-031 target');const p=await page({who:a});const add=f.addButton(p);await add.focus();await p.keyboard.press('Enter');await dialog(p).waitFor();
  assert.equal(await dialog(p).getByLabel('Title',{exact:false}).evaluate(x=>x===document.activeElement),true);
  await p.keyboard.press('Tab');await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).focus();await p.keyboard.press('Enter');assert.equal(await dialog(p).getByLabel('Title',{exact:false}).evaluate(x=>x===document.activeElement),true);
  await p.keyboard.press('Escape');await eventually(async()=>assert(await add.evaluate(x=>x===document.activeElement)));
  await add.focus();await p.keyboard.press('Enter');await dialog(p).getByLabel('Title',{exact:false}).fill('TC-031 keyboard');await dialog(p).getByLabel('Link',{exact:false}).fill(base+'/');await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).focus();await p.keyboard.press('Enter');await dialog(p).waitFor({state:'hidden'});
  const more=p.getByRole('button',{name:'More actions for TC-031 keyboard',exact:true});await more.focus();await p.keyboard.press('Enter');await p.getByRole('menuitem',{name:'Edit bookmark',exact:true}).waitFor();await p.keyboard.press('Escape');assert(await more.evaluate(x=>x===document.activeElement));
  await selected(p,'TC-031 keyboard').focus();await p.keyboard.press('Space');assert(await selected(p,'TC-031 keyboard').isChecked());
  const target=p.getByRole('combobox',{name:'Move to group',exact:true});await target.focus();await p.keyboard.press('Enter');const option=p.getByRole('option',{name:'TC-031 target',exact:true});await option.waitFor();await p.keyboard.press('End');await eventually(async()=>assert(await option.evaluate(x=>x===document.activeElement)));await p.keyboard.press('Enter');await p.getByRole('button',{name:'Move 1 bookmarks',exact:true}).focus();await p.keyboard.press('Enter');await p.getByRole('group',{name:'Batch bookmark move'}).waitFor({state:'hidden'});assert.equal((await all(a))[0].group_id,(await list(a)).groups[0].id);
  await more.focus();await p.keyboard.press('Enter');const deletion=p.getByRole('menuitem',{name:'Delete bookmark',exact:true});await deletion.waitFor();await p.keyboard.press('End');await eventually(async()=>assert(await deletion.evaluate(x=>x===document.activeElement)));await p.keyboard.press('Enter');await dialog(p).getByRole('heading',{name:'Delete this bookmark?',exact:true}).waitFor();await dialog(p).getByRole('button',{name:'Cancel',exact:true}).focus();await p.keyboard.press('Enter');await dialog(p).waitFor({state:'hidden'});await eventually(async()=>assert(await more.evaluate(x=>x===document.activeElement)));assert.equal((await list(a)).all_count,1);
});

scenario('TC-032', async () => {
  const a=await user();await bookmark(a,'TC-032 state');
  const failures=[],hitFailures=[];
  for(const theme of ['light','dark'])for(const width of [1440,390]){
    const p=await page({who:a,theme,viewport:{width,height:900}});await selected(p,'TC-032 state').check();assert.equal(await selected(p,'TC-032 state').getAttribute('aria-label'),'Select TC-032 state');
    const hit=await selected(p,'TC-032 state').evaluate(x=>{const r=(x.closest('label')||x).getBoundingClientRect();return {width:r.width,height:r.height};});if(width===390){assert(hit.width>=44&&hit.height>=44,'mobile checkbox hit area below 44px');}
    const audit=async stage=>{const samples=await p.evaluate(require('./report.cjs').renderedContrast);assert(samples.length>0);f.atomic(require('node:path').join(f.runDir,`TC-032-colors-${theme}-${width}-${stage}.json`),samples);const bad=samples.filter(x=>x.ratio+0.01<x.minimum);if(bad.length){failures.push({theme,width,stage,samples:bad});await p.screenshot({path:require('node:path').join(f.runDir,`TC-032-${theme}-${width}-${stage}.png`)});}};
    await audit('selected');
    if(width===390){const small=await p.evaluate(()=>[...document.querySelectorAll('button,a[href],input,textarea,[role=combobox]')].map(n=>{const e=n.matches('input[type=checkbox]')?n.closest('label')||n:n;const r=e.getBoundingClientRect();return {name:n.getAttribute('aria-label')||n.textContent.trim().slice(0,50),width:r.width,height:r.height,hidden:!r.width||!r.height||r.bottom<=0||r.right<=0||r.top>=innerHeight||r.left>=innerWidth||n.disabled||n.getAttribute('aria-disabled')==='true'||getComputedStyle(n).visibility==='hidden'};}).filter(n=>!n.hidden&&(n.width<44||n.height<44)));hitFailures.push({theme,width,controls:small});}
    await p.getByRole('button',{name:'Cancel selection',exact:true}).click();await f.addButton(p).click();await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).click();const input=dialog(p).getByLabel('Title',{exact:false});assert.equal(await input.getAttribute('aria-invalid'),'true');assert(await input.getAttribute('aria-describedby'));await noOverflow(p);
    await audit('invalid-focus');await input.fill('TC-032 pending');await dialog(p).getByLabel('Link',{exact:false}).fill(base+'/');let release,pending=false;const held=new Promise(r=>release=r);await p.route('**/api/v1/bookmarks',async route=>{if(route.request().method()==='POST'){pending=true;await held;}await route.continue();});await dialog(p).getByRole('button',{name:'Save bookmark',exact:true}).click();await eventually(()=>assert(pending));const busy=dialog(p).getByRole('button',{name:'Saving…',exact:true});assert(await busy.isDisabled());assert.equal(await busy.getAttribute('aria-busy'),'true');assert(await input.isDisabled());await audit('pending-disabled');release();await dialog(p).waitFor({state:'hidden'});await p.unrouteAll({behavior:'wait'});
  }
  f.atomic(require('node:path').join(f.runDir,'TC-032-findings.json'),{failures,hitFailures});assert.equal(failures.length+hitFailures.reduce((n,x)=>n+x.controls.length,0),0,JSON.stringify({failures,hitFailures}));
});

scenario('TC-034', async () => {
  const a=await user(),b=await user('b'),p=await page({who:a});await createGroupUI(p,'TC-034 research');
  for(let i=0;i<12;i++)await f.save(p,{title:'TC-034 resource '+i,groupName:'TC-034 research',note:'research note'});
  const g=(await list(a)).groups[0];assert.equal((await list(b)).all_count,0);await search(p,'resource');await selected(p,'TC-034 resource 11').check();await selected(p,'TC-034 resource 10').check();await f.move(p,2,'Ungrouped');
  await f.groupMenu(p,'TC-034 research','Rename group');await dialog(p).getByLabel('Group name',{exact:false}).fill('TC-034 renamed');await dialog(p).getByRole('button',{name:'Save name',exact:true}).click();await dialog(p).waitFor({state:'hidden'});
  await p.goto(base+'/bookmarks?group='+g.id);await f.groupMenu(p,'TC-034 renamed','Delete group');await dialog(p).getByRole('button',{name:'Delete group',exact:true}).click();await dialog(p).waitFor({state:'hidden'});await eventually(()=>assert.equal(new URL(p.url()).searchParams.get('group'),'ungrouped'));
  await f.logout(p,a);await f.login(p,await user());assert.equal((await list(a)).all_count,12);await p.getByRole('button',{name:'Next',exact:true}).click();await p.getByText('Page 2 / 2 · 12 bookmarks',{exact:true}).waitFor();await search(p,'TC-034 resource 11');await heading(p,'TC-034 resource 11').waitFor();await p.getByRole('button',{name:'View note for TC-034 resource 11',exact:true}).click();await dialog(p).getByText('research note',{exact:true}).waitFor();await dialog(p).getByRole('button',{name:'Close',exact:true}).click();
  const before=p.url(),popupEvent=p.waitForEvent('popup');await p.getByRole('link',{name:'Open TC-034 resource 11 in a new tab',exact:true}).click();const popup=await popupEvent;await popup.waitForLoadState();assert(popup.url().startsWith(base+'/?qa='));assert.equal(p.url(),before);await popup.close();
  await f.menu(p,'TC-034 resource 11','Edit bookmark');await f.save(p,{title:'TC-034 edited'},true);await p.getByRole('button',{name:'Clear keywords',exact:true}).click();await heading(p,'TC-034 edited').waitFor();await deleteUI(p,'TC-034 edited');assert.equal((await list(a)).all_count,11);
});
