import test from 'node:test';
import assert from 'node:assert/strict';
import { SUITS, analyze, auctionEnded, contract, nextSeat, legalCalls, validDeal } from '../src/cards.js';
import { decide, evaluate, generateHands } from '../src/engine.js';
import { DEFAULT_SYSTEM, SAYC_SYSTEM, PRECISION_SYSTEM, PRESETS, validateSystem } from '../src/systems.js';
import { defaults, load, persist, STORAGE_KEY, validateBoard, encodeBoard, decodeBoard } from '../src/storage.js';

const hand = (...suits) => { const h = suits.flatMap((ranks, i) => [...ranks].map(r => SUITS[i] + r)); assert.equal(h.length, 13); return h; };
const h11 = hand('AQ3', 'K84', '982', 'Q763');
const h13 = hand('AQ3', 'K84', 'Q82', 'Q763');
const h16 = hand('AQ3', 'KJ4', 'K82', 'QJ63');
const h18 = hand('AQ3', 'KQ4', 'K82', 'KJ63');
const h20 = hand('AKQ', 'KJ4', 'K82', 'KJ63');
const h22 = hand('AKQ', 'AK4', 'K82', 'K763');
const h26 = hand('AKQ', 'AK4', 'KQ2', 'KQ63');
const h8 = hand('K83', 'Q84', 'Q82', 'J763');
const h6 = hand('Q83', 'Q84', 'Q82', '8763');
const weak = hand('9876', '765', '654', '543');
const ctx = (h, system, history = [], seat = 'N') => ({ hand: h, system, history, seat });
const rec = (h, system, history = [], seat = 'N') => decide(ctx(h, system, history, seat)).recommended?.call;
const e = (h, system, history, seat, call) => evaluate(ctx(h, system, history, seat), call);
function auction(n, s, system, systems = { NS: system, EW: DEFAULT_SYSTEM }) {
  const history = []; let seat = 'N';
  while (!auctionEnded(history) && history.length < 40) {
    const h = seat === 'N' ? n : seat === 'S' ? s : weak, sy = systems[['N', 'S'].includes(seat) ? 'NS' : 'EW'];
    const call = rec(h, sy, history, seat);
    assert.ok(call, `Missing rule (${system.id}) ${seat}: ${history.map(e => e.call).join(' ')}`);
    assert.ok(legalCalls(history, seat).includes(call)); history.push(e(h, sy, history, seat, call)); seat = nextSeat(seat);
  }
  assert.ok(auctionEnded(history)); return history;
}
function seeded(seed) { return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }; }

test('three independent default systems, including fresh and legacy data', () => {
  const state = defaults(); assert.deepEqual(state.systems.map(s => s.id), ['standard', 'sayc', 'precision']);
  state.systems[1].name = 'Changed'; assert.notEqual(SAYC_SYSTEM.name, 'Changed');
  for (const s of PRESETS) assert.deepEqual(validateSystem(s), []);
});
test('the same strong balanced hand opens differently in Precision and SAYC', () => {
  assert.equal(analyze(h16).hcp, 16);
  assert.equal(rec(h16, SAYC_SYSTEM), '1NT');
  assert.equal(rec(h16, PRECISION_SYSTEM), '1C');
  assert.equal(rec(h13, PRECISION_SYSTEM), '1NT');
  assert.equal(rec(h13, SAYC_SYSTEM), '1D');
  assert.equal(rec(h11, PRECISION_SYSTEM), '1D');
  assert.equal(rec(h11, SAYC_SYSTEM), 'P');
});
test('SAYC has strong 2C, 20–21 2NT and 25–27 3NT; Precision 2NT is 22–24', () => {
  assert.equal(analyze(h20).hcp, 20); assert.equal(analyze(h22).hcp, 22); assert.equal(analyze(h26).hcp, 26);
  assert.equal(rec(h20, SAYC_SYSTEM), '2NT'); assert.equal(rec(h22, SAYC_SYSTEM), '2C'); assert.equal(rec(h26, SAYC_SYSTEM), '3NT');
  assert.equal(rec(h22, PRECISION_SYSTEM), '2NT'); assert.equal(rec(h20, PRECISION_SYSTEM), '1C');
});
test('Precision limited majors, natural clubs and short diamonds are distinct', () => {
  const major = hand('K83', 'AQ984', 'Q82', '76');
  const clubs = hand('KQ83', 'J84', 'AQ986', '7');
  const shortD = hand('AKJ8', 'KJ84', '9876', '2');
  assert.equal(rec(major, PRECISION_SYSTEM), '1H'); assert.equal(rec(clubs, PRECISION_SYSTEM), '2C'); assert.equal(rec(shortD, PRECISION_SYSTEM), '2D');
  const shortEntry = e(shortD, PRECISION_SYSTEM, [], 'N', '2D'); assert.equal(shortEntry.rule, 'precisionShortD'); assert.ok(shortEntry.alert);
  assert.equal(e(clubs, PRECISION_SYSTEM, [], 'N', '2C').rule, 'precisionClubs');
});
test('SAYC weak two at five points does not become a Precision short diamond', () => {
  const h = hand('983', '84', '76', 'KQ9876');
  assert.equal(rec(h, SAYC_SYSTEM), '2D'); assert.equal(rec(h, PRECISION_SYSTEM), 'P');
  assert.equal(e(h, PRECISION_SYSTEM, [], 'N', '2D').feedback, 'mismatch');
});
test('Precision strong club negative is artificial and reaches notrump invitation', () => {
  const history = auction(h16, h6, PRECISION_SYSTEM);
  assert.deepEqual(history.filter(e => e.call !== 'P').map(e => e.call), ['1C', '1D', '1NT', '2NT']);
  assert.equal(history.find(e => e.call === '1D').rule, 'precisionNegative');
  assert.equal(contract(history).declarer, 'N');
});
test('Precision positive balanced response is forcing and reaches game', () => {
  const history = auction(h16, h8, PRECISION_SYSTEM);
  assert.deepEqual(history.filter(e => e.call !== 'P').map(e => e.call), ['1C', '1NT', '3NT']);
  assert.equal(history.find(e => e.call === '1NT').forcing, true);
  assert.equal(contract(history).declarer, 'S');
});
test('Precision short-diamond responses are not weak-two responses', () => {
  const n = hand('AKJ8', 'KJ84', '9876', '2'), s = hand('Q987', 'Q76', 'A95', 'J83');
  const history = auction(n, s, PRECISION_SYSTEM);
  assert.equal(history.find(e => e.seat === 'S').call, '2S'); assert.equal(contract(history).call, '2S');
});
test('Precision natural 2C accepts a weak club partscore', () => {
  const n = hand('KQ83', 'J84', 'AQ986', '7');
  assert.equal(contract(auction(n, h6, PRECISION_SYSTEM)).call, '2C');
});
test('SAYC waiting 2D and balanced 2NT rebid reach game', () => {
  const history = auction(h22, h6, SAYC_SYSTEM);
  assert.deepEqual(history.filter(e => e.call !== 'P').map(e => e.call), ['2C', '2D', '2NT', '3NT']);
  assert.equal(history.find(e => e.call === '2D').rule, 'strongWaiting');
});
test('SAYC 2NT Stayman and transfers play at the three level', () => {
  const s = hand('QJ98', 'Q76', 'A95', 'J83');
  const h = auction(h20, s, SAYC_SYSTEM);
  assert.equal(h.find(e => e.seat === 'S').call, '3C');
  const transfer = hand('Q83', 'KJ984', 'Q82', '76');
  const h2 = auction(h20, transfer, SAYC_SYSTEM);
  assert.deepEqual(h2.filter(e => e.call !== 'P').map(e => e.call), ['2NT', '3D', '3H', '3NT', '4H']);
});
test('SAYC Jacoby 2NT replaces the teaching strong direct game raise', () => {
  const n = hand('K83', 'AQJ84', 'K82', '76');
  const s = hand('AQ3', 'K984', 'K82', 'J76');
  const history = auction(n, s, SAYC_SYSTEM);
  assert.deepEqual(history.filter(e => e.call !== 'P').map(e => e.call), ['1H', '2NT', '4H']);
  assert.equal(history.find(e => e.call === '2NT').rule, 'jacobyRaise');
  const opening = [e(n, SAYC_SYSTEM, [], 'N', '1H'), { seat: 'E', call: 'P' }];
  assert.equal(e(s, SAYC_SYSTEM, opening, 'S', '4H').feedback, 'mismatch');
});
test('Jacoby shows a short side suit before game', () => {
  const n = hand('K3', 'AQJ84', 'K9872', '7'), s = hand('AQ3', 'K984', 'K82', 'J76');
  const history = auction(n, s, SAYC_SYSTEM);
  assert.deepEqual(history.filter(e => e.call !== 'P').map(e => e.call), ['1H', '2NT', '3D', '4H']);
});
test('passed hands cannot use Jacoby 2NT', () => {
  const n = hand('K83', 'AQJ84', 'K82', '76'), s = hand('AQ3', 'K984', 'K82', 'J76');
  const h = [{ seat: 'S', call: 'P' }, { seat: 'W', call: 'P' }]; h.push(e(n, SAYC_SYSTEM, h, 'N', '1H'), { seat: 'E', call: 'P' });
  assert.equal(e(s, SAYC_SYSTEM, h, 'S', '2NT').feedback, 'mismatch');
});
test('incompatible strong 2C and Jacoby raises are rejected for Precision', () => {
  assert.ok(validateSystem({ ...PRECISION_SYSTEM, conventions: [...PRECISION_SYSTEM.conventions, 'strong2c'] }).length);
  assert.ok(validateSystem({ ...PRECISION_SYSTEM, conventions: [...PRECISION_SYSTEM.conventions, 'jacoby2nt'] }).length);
  assert.ok(validateSystem({ ...PRECISION_SYSTEM, ntMin: 15, ntMax: 17 }).length);
  assert.ok(validateSystem({ ...SAYC_SYSTEM, base: 'unrecognized' }).length);
  assert.equal(validateSystem({ ...DEFAULT_SYSTEM, conventions: [...DEFAULT_SYSTEM.conventions, 'strong2c', 'jacoby2nt'] }).length, 0);
});
test('new presets are added once to existing storage, preserving customization and selection', () => {
  const data = new Map(); const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
  try {
    const old = { ...defaults(), presetCatalogVersion: undefined, systems: [{ ...DEFAULT_SYSTEM, name: 'My old card', ntMin: 12, ntMax: 14 }] };
    data.set(STORAGE_KEY, JSON.stringify(old));
    const { state, error } = load(); assert.equal(error, false); assert.equal(state.systems.length, 3); assert.equal(state.systems[0].name, 'My old card'); assert.equal(state.systems[0].ntMin, 12); assert.equal(state.ns, 'standard');
    state.systems = state.systems.filter(s => s.id !== 'precision'); persist(state);
    assert.equal(load().state.systems.length, 2); // Explicit removal survives reload.
  } finally { if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});
test('both new systems complete supported generated drills and round-trip their snapshots', async () => {
  for (const system of [SAYC_SYSTEM, PRECISION_SYSTEM]) for (const theme of ['nt', 'stayman', 'transfers', 'strong']) for (let i = 0; i < 8; i++) {
    const hands = await generateHands(theme, system, seeded(i + 32)); assert.ok(validDeal(hands));
    const history = []; let seat = 'N';
    while (!auctionEnded(history) && history.length < 40) {
      const sy = ['N', 'S'].includes(seat) ? system : DEFAULT_SYSTEM;
      const call = rec(hands[seat], sy, history, seat);
      assert.ok(call, `${system.id}/${theme} ${seat}: ${history.map(e => e.call)}`);
      history.push(e(hands[seat], sy, history, seat, call)); seat = nextSeat(seat);
    }
    assert.ok(auctionEnded(history));
    const board = { id: 'new-system', hands, history, dealer: 'N', vulnerability: 'none', status: 'complete', systems: { NS: system, EW: DEFAULT_SYSTEM }, theme };
    const checked = validateBoard(board); assert.equal(checked.systems.NS.base, system.base);
    assert.deepEqual(decodeBoard(encodeBoard(checked)).history.map(e => e.call), history.map(e => e.call));
  }
});
