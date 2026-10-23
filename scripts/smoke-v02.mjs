// Uses the same optional Playwright/browser environment variables as smoke.mjs.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { defaults } from '../src/storage.js';
import { evaluate } from '../src/engine.js';
const { chromium } = await import(process.env.BRIDGE_PLAYWRIGHT ? pathToFileURL(process.env.BRIDGE_PLAYWRIGHT).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BRIDGE_BROWSER ? { executablePath: process.env.BRIDGE_BROWSER } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const base = process.env.BRIDGE_URL || 'http://127.0.0.1:4173/bridge-bidding-practice/';
const hand = (...suits) => suits.flatMap((ranks, i) => [...ranks].map(r => ['S', 'H', 'C', 'D'][i] + r));
const state = defaults();
state.language = 'en';
state.settings.speed = 0;
const board = { id: 'v02-regression', hands: {
  N: hand('KJT86', 'JT4', 'K3', 'T74'), E: hand('3', '962', 'AT', 'KQJ9653'),
  S: hand('Q542', 'AQ7', '98762', '8'), W: hand('A97', 'K853', 'QJ54', 'A2')
}, dealer: 'W', vulnerability: 'NS', history: [], systems: { NS: state.systems[0], EW: state.systems[0] }, theme: 'free', status: 'active', created: Date.now() };
for (const [seat, call] of [['W', '1C'], ['N', '1S']]) board.history.push(evaluate({ hand: board.hands[seat], seat, history: board.history, system: board.systems.NS, completeAuction: true }, call));
state.current = board;
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(base);
  await page.evaluate(s => localStorage.setItem('bridge-studio-v01', JSON.stringify(s)), state);
  await page.reload();
  await page.locator('[data-action="nav"][data-page="table"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('bridge-studio-v01')).current.history.length === 3);
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem('bridge-studio-v01')).current);
  assert.equal((await snapshot()).history[2].seat, 'E');
  assert.equal((await snapshot()).history[2].call, '2D');
  assert.equal((await snapshot()).status, 'active');
  assert.ok(!/[\u3400-\u9fff]/u.test(await page.locator('body').innerText()), 'English table contains Chinese');
  const confirm = await page.locator('[data-action="submit"]').boundingBox();
  assert.ok(confirm.y + confirm.height <= 800, 'desktop bidding requires scrolling');
  assert.equal(await page.locator('.table-center .auction-panel').count(), 1);
  await page.screenshot({ path: 'test-results/v02-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileConfirm = await page.locator('[data-action="submit"]').boundingBox();
  assert.ok(mobileConfirm.y >= 0 && mobileConfirm.y + mobileConfirm.height <= 844, 'mobile bidding is outside viewport');
  await page.screenshot({ path: 'test-results/v02-mobile.png', fullPage: true });
  for (let n = 0; n < 50 && (await snapshot()).status === 'active'; n++) {
    await page.waitForFunction(() => { const b = JSON.parse(localStorage.getItem('bridge-studio-v01')).current; return b.status !== 'active' || b.history.at(-1)?.seat === 'E'; });
    if ((await snapshot()).status !== 'active') break;
    assert.ok((await snapshot()).history.at(-1).seat === 'E', 'user must only control South');
    await page.locator('[data-action="choose"][data-call="P"]').click();
    await page.locator('[data-action="submit"]').click();
  }
  assert.equal((await snapshot()).status, 'complete');
  await page.reload();
  await page.locator('[data-action="nav"][data-page="table"]').click();
  assert.equal((await snapshot()).status, 'complete');
  assert.deepEqual(errors, []);
  console.log('V0.2 browser acceptance passed: original competitive deal, automatic opponents, South-only input, complete auction, English text, persistence, central auction and visible desktop/mobile bidding.');
} finally { await browser.close(); }
