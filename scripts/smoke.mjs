// Optional browser acceptance suite. Install Playwright separately or set
// BRIDGE_PLAYWRIGHT to its index.mjs; the application itself has no dependencies.
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.BRIDGE_PLAYWRIGHT ? pathToFileURL(process.env.BRIDGE_PLAYWRIGHT).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BRIDGE_BROWSER ? { executablePath: process.env.BRIDGE_BROWSER } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results', { recursive: true });
const base = process.env.BRIDGE_URL || 'http://127.0.0.1:4173/bridge-bidding-practice/';
const action = name => page.locator(`[data-action="${name}"]`).first();
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('bridge-studio-v01')));
try {
  await page.goto(base);
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await action('settings').click();
  await page.selectOption('select[name="speed"]', '0');
  await action('close').click();
  await page.locator('[data-theme="stayman"]').click();
  await action('begin').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bridge-studio-v01')).current?.history.length === 2);
  assert.equal((await saved()).current.history[0].call, '1NT');
  await page.screenshot({ path: 'test-results/table-desktop.png', fullPage: true });
  const before = (await saved()).current.history.length;
  await action('language').click();
  assert.equal((await saved()).current.history.length, before);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await action('language').click();
  await action('hint').click();
  assert.ok((await saved()).current.assisted);
  await page.locator('[data-action="choose"][data-call="2C"]').click();
  await action('submit').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bridge-studio-v01')).current?.history.length >= 6);
  await action('undo').click();
  assert.equal((await saved()).current.history.length, 2);
  // Finish using the same public decision API as the training engine.
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(60);
    const b = (await saved()).current;
    if (b.status !== 'active') break;
    const next = await page.evaluate(async () => {
      const { decide } = await import('./src/engine.js');
      const b = JSON.parse(localStorage.getItem('bridge-studio-v01')).current;
      return decide({ hand: b.hands.S, seat: 'S', history: b.history, system: b.systems.NS }).recommended?.call;
    });
    assert.ok(next);
    await page.locator(`[data-action="choose"][data-call="${next}"]`).click();
    await action('submit').click();
  }
  assert.equal((await saved()).current.status, 'complete');
  await action('favorite').click();
  await action('mistake').click();
  await page.locator('#review-note').fill('复盘记录 / review note');
  await page.screenshot({ path: 'test-results/review-desktop.png', fullPage: true });
  const noteId = (await saved()).current.id;
  await page.reload();
  await action('resume').click();
  assert.equal(await page.locator('#review-note').inputValue(), '复盘记录 / review note');
  assert.equal((await saved()).current.id, noteId);
  const downloadEvent = page.waitForEvent('download');
  await action('exportDeal').click();
  const download = await downloadEvent;
  await download.saveAs('test-results/exported-deal.json');
  await page.locator('[data-action="nav"][data-page="system"]').first().click();
  await page.locator('[data-convention="naturalClubs"]').check();
  assert.ok(await action('saveSystem').isDisabled());
  assert.match(await page.locator('.notice').textContent(), /1NT/);
  await page.screenshot({ path: 'test-results/system-conflict.png', fullPage: true });
  await page.locator('[data-convention="naturalClubs"]').uncheck();
  await page.locator('#system-name').fill('我的体系 / My system');
  await action('saveSystem').click();
  assert.equal((await saved()).systems[0].name, '我的体系 / My system');
  await page.locator('[data-action="nav"][data-page="library"]').first().click();
  await page.locator('#library-search').fill('stayman');
  assert.equal(await page.locator('.library-card').count(), 1);
  await page.locator('#library-search').fill('');
  await page.locator('[data-action="nav"][data-page="records"]').first().click();
  assert.equal(await page.locator('.record-card').count(), 1);
  await page.locator('#import-file').setInputFiles('test-results/exported-deal.json');
  await page.waitForTimeout(100);
  assert.equal((await saved()).records.length, 2);
  assert.equal((await saved()).current.note, '复盘记录 / review note');
  // Invalid import must not alter existing state.
  const stateBefore = await saved();
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":99}') });
  await page.waitForTimeout(100);
  assert.deepEqual(await saved(), stateBefore);
  // Shared links survive a reload and include the original system snapshot.
  const shared = await page.evaluate(async () => { const { encodeBoard } = await import('./src/storage.js'); return encodeBoard(JSON.parse(localStorage.getItem('bridge-studio-v01')).current); });
  await page.goto(base + '#deal=' + shared);
  await page.waitForTimeout(100);
  assert.equal((await saved()).current.systems.NS.name, '五张高花 · Five-card majors');
  for (const width of [390, 360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const p of ['table', 'home', 'system', 'library', 'records']) {
      await page.locator(`.nav-item[data-page="${p}"]`).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `Horizontal overflow on ${p} at ${width}`);
      if (width === 390 || (width === 1440 && p === 'library')) await page.screenshot({ path: `test-results/${p}-${width}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  console.log('Browser acceptance passed: session, undo, bilingual UI, review, persistence, conflicts, search, export/import, share, five routes at four widths.');
} finally { await browser.close(); }
