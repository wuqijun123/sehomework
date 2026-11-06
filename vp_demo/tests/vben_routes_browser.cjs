// Exercise the published frontend, with an isolated account/database and no model calls.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require(process.env.VP_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vplab-vben-routes-'));
let child, browser;
async function boot() {
  child = spawn(process.env.VP_TEST_PYTHON || 'python', ['-u', 'server.py', '--port', '0'], {
    cwd: root, windowsHide: true,
    env: { ...process.env, VPLAB_DB: path.join(tmp, 'test.sqlite3') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let out = '', err = '';
    const timer = setTimeout(() => reject(Error('Boot timed out: ' + err)), 15000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.stderr.on('data', s => err += s);
    child.once('exit', code => { clearTimeout(timer); reject(Error('Exit ' + code + ': ' + err)); });
    child.stdout.on('data', s => {
      out += s;
      const match = out.match(/VP Lab: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
}
(async () => {
  try {
    const base = await boot();
    browser = await chromium.launch({ headless: true, executablePath: process.env.VP_BROWSER_EXE });
    const context = await browser.newContext();
    await context.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const response = await context.request.post(base + '/api/register', {
      data: { username: 'route_fixture', password: 'route-fixture-password' },
    });
    assert.equal(response.status(), 200);
    for (const [query, tab, title] of [
      ['?tab=intelligent', 'intelligent', '智能推荐'],
      ['?tab=tasks', 'tasks', '补题与复习计划'],
      ['?tab=tasks#/intelligent', 'intelligent', '智能推荐'],
    ]) {
      await page.goto(base + '/' + query);
      await page.waitForFunction(expected => window.vpDocument?.querySelector('#page-label')?.textContent === expected,
        tab === 'tasks' ? '补题计划' : '智能推荐');
      await page.waitForFunction(expected => location.hash === '#/' + expected, tab);
      assert.equal(new URL(page.url()).searchParams.has('tab'), false);
      assert.equal(await page.locator('#main h1').textContent(), title);
      await page.reload();
      await page.locator('#main h1').filter({ hasText: title }).waitFor();
    }
    // Preserve the unauthenticated user's destination through registration.
    const anon = await browser.newContext(), authPage = await anon.newPage();
    await authPage.goto(base + '/?tab=intelligent');
    await authPage.locator('#auth-form [name=username]').fill('route_new_user');
    await authPage.locator('#auth-form [name=password]').fill('route-fixture-password');
    await authPage.locator('#auth-submit').click();
    await authPage.locator('#smart-preference').waitFor();
    assert.equal(new URL(authPage.url()).hash, '#/intelligent');
    // Room login/return parameters still take precedence over workspace navigation.
    const roomResponse = await context.request.post(base + '/api/rooms', { data: { mode: 'replay', maxMinutes: 120 } });
    assert.equal(roomResponse.status(), 200);
    const room = await roomResponse.json();
    await page.goto(base + '/?next=duo&room=' + room.id + '&tab=tasks');
    await page.waitForURL(base + '/duo?room=' + room.id);
    assert.deepEqual(errors, []);
    console.log('Published Vben routes passed: old links, hash priority, reload, login and VP room return.');
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
