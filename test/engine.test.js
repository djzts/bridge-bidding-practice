import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, deal, validDeal, deck, legalCalls, auctionEnded, contract, nextSeat, SEATS, SUITS, bidValue } from '../src/cards.js';
import { decide, evaluate, generateHands } from '../src/engine.js';
import { DEFAULT_SYSTEM, validateSystem } from '../src/systems.js';
import { validateBoard, validatePayload, encodeBoard, decodeBoard } from '../src/storage.js';
const system = structuredClone(DEFAULT_SYSTEM);
const hand = (...suits) => suits.flatMap((ranks, i) => [...ranks].map(r => SUITS[i] + r));
const nt15 = hand('AQ3', 'KJ4', 'K82', 'Q763');
const nt17 = hand('AQ3', 'KJ4', 'KQ2', 'Q763');
const weak = hand('9876', '765', '654', '543');
const context = (h, seat = 'N', history = [], s = system) => ({ hand: h, seat, history, system: s });
function entry(h, seat, history, call, s = system) { return evaluate(context(h, seat, history, s), call); }
function recommend(h, seat, history, s = system) { return decide(context(h, seat, history, s)).recommended?.call; }
function seeded(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function ntAuction(n, s, max = 12) {
  const history = []; let seat = 'N';
  for (let i = 0; i < max && !auctionEnded(history); i++) {
    const h = seat === 'N' ? n : seat === 'S' ? s : weak;
    const call = recommend(h, seat, history);
    assert.ok(call, `No rule for ${seat}: ${history.map(e => e.call).join(' ')}`);
    assert.ok(legalCalls(history, seat).includes(call));
    history.push(entry(h, seat, history, call)); seat = nextSeat(seat);
  }
  return history;
}
test('deal conserves 52 unique cards and 40 HCP', () => {
  for (let i = 0; i < 100; i++) { const hands = deal(seeded(i)); assert.ok(validDeal(hands)); assert.equal(SEATS.reduce((sum, s) => sum + analyze(hands[s]).hcp, 0), 40); }
  const bad = deal(); bad.N[0] = bad.S[0]; assert.equal(validDeal(bad), false);
});
test('HCP, balanced shapes and five-card major configuration', () => {
  assert.equal(analyze(nt15).hcp, 15); assert.equal(analyze(nt17).hcp, 17); assert.ok(analyze(nt15).balanced);
  assert.equal(recommend(nt15), '1NT');
  const h = hand('AQJ83', 'KJ4', 'K82', 'Q7');
  assert.equal(recommend(h), '1S'); assert.equal(recommend(h, 'N', [], { ...system, allowFiveMajor: true }), '1NT');
});
test('auction legality: bids, double, redouble, intervening passes, termination', () => {
  let h = [{ seat: 'N', call: '1H' }];
  assert.ok(legalCalls(h, 'E').includes('X')); assert.ok(!legalCalls(h, 'S').includes('X')); assert.ok(!legalCalls(h, 'E').includes('1D'));
  h.push({ seat: 'E', call: 'X' }); assert.ok(legalCalls(h, 'S').includes('XX')); assert.ok(!legalCalls(h, 'W').includes('XX'));
  h.push({ seat: 'S', call: 'P' }, { seat: 'W', call: 'P' }); assert.ok(legalCalls(h, 'N').includes('XX'));
  h.push({ seat: 'N', call: 'XX' }, { seat: 'E', call: 'P' }, { seat: 'S', call: 'P' }, { seat: 'W', call: 'P' }); assert.ok(auctionEnded(h)); assert.deepEqual(legalCalls(h, 'N'), []);
  assert.equal(auctionEnded(['N', 'E', 'S'].map(seat => ({ seat, call: 'P' }))), false);
  assert.equal(auctionEnded(SEATS.map(seat => ({ seat, call: 'P' }))), true);
});
test('declarer is first partnership player to name final strain', () => {
  const h = [{ seat: 'N', call: '1H' }, { seat: 'E', call: '1S' }, { seat: 'S', call: '2H' }, { seat: 'W', call: 'X' }];
  assert.deepEqual(contract(h), { call: '2H', declarer: 'N', doubled: '×' });
});
test('transfer game selects major with three-card support', () => {
  const s = hand('Q83', 'KJ984', 'A82', '76');
  const h = ntAuction(nt15, s);
  assert.deepEqual(h.filter(e => e.call !== 'P').map(e => e.call), ['1NT', '2D', '2H', '3NT', '4H']);
  assert.equal(contract(h).declarer, 'N'); assert.ok(auctionEnded(h));
});
test('transfer invitation: minimum returns to 3H, maximum bids 4H', () => {
  const s = hand('Q83', 'KJ984', 'Q82', '76');
  assert.equal(contract(ntAuction(nt15, s)).call, '3H');
  assert.equal(contract(ntAuction(nt17, s)).call, '4H');
});
test('six-card major transfer invitation is declined or accepted', () => {
  const s = hand('Q8', 'KJ9842', 'Q82', '76');
  assert.equal(contract(ntAuction(nt15, s)).call, '3H');
  assert.equal(contract(ntAuction(nt17, s)).call, '4H');
});
test('transfer does not silently ignore a second four-card major', () => {
  const s = hand('KQ98', 'J9876', 'A2', '76');
  const history = [entry(nt15, 'N', [], '1NT'), { seat: 'E', call: 'P' }];
  history.push(entry(s, 'S', history, '2D'), { seat: 'W', call: 'P' });
  history.push(entry(nt15, 'N', history, '2H'), { seat: 'E', call: 'P' });
  assert.equal(recommend(s, 'S', history), undefined);
});
test('Stayman finds spades after opener first shows hearts', () => {
  const n = hand('AQ83', 'KJ84', 'K82', 'Q7');
  const s = hand('KJ98', 'Q76', 'A95', 'J83');
  const h = ntAuction(n, s);
  assert.deepEqual(h.filter(e => e.call !== 'P').map(e => e.call), ['1NT', '2C', '2H', '3NT', '4S']);
});
test('Stayman denial is artificial and leads to notrump game', () => {
  const s = hand('KJ98', 'Q76', 'A95', 'J83');
  const h = ntAuction(nt15, s);
  assert.equal(h.find(e => e.call === '2D').alert, true); assert.equal(contract(h).call, '3NT');
});
test('uncovered and mismatched user calls are distinguished', () => {
  const h = [entry(nt15, 'N', [], '1NT'), { seat: 'E', call: 'P' }];
  assert.equal(entry(weak, 'S', h, '4NT').feedback, 'uncovered');
  assert.equal(entry(weak, 'S', h, '3NT').feedback, 'mismatch');
  assert.equal(decide(context(hand('AKQJ', 'AKQ', 'AKQ', 'AK2'))).recommended, null);
});
test('convention conflicts and invalid configurations are rejected', () => {
  assert.equal(validateSystem(system).length, 0);
  assert.ok(validateSystem({ ...system, conventions: ['stayman', 'naturalClubs'] }).length);
  assert.ok(validateSystem({ ...system, conventions: ['transfers', 'naturalMajors'] }).length);
  assert.ok(validateSystem({ ...system, conventions: ['rkcb'] }).length);
  assert.ok(validateSystem({ ...system, ntMin: 10 }).length);
});
test('weak notrump changes responder thresholds', () => {
  const s = { ...system, ntMin: 12, ntMax: 14 };
  const n = hand('AQ3', 'K84', 'K82', 'J763');
  const h = [entry(n, 'N', [], '1NT', s), { seat: 'E', call: 'P' }];
  assert.equal(recommend(hand('Q83', 'KJ4', 'A82', '8763'), 'S', h, s), 'P');
});
test('decisions do not use hidden hands', () => {
  const ctx = context(nt15);
  assert.deepEqual(decide({ ...ctx, otherHands: deal(seeded(1)) }), decide({ ...ctx, otherHands: deal(seeded(2)) }));
});
test('generated topic deals satisfy constraints and complete under recommendations', async () => {
  for (const theme of ['nt', 'stayman', 'transfers']) for (let i = 0; i < 6; i++) {
    const hands = await generateHands(theme, system, seeded(i + 50));
    assert.ok(validDeal(hands));
    assert.equal(recommend(hands.N), '1NT');
    const h = []; let seat = 'N';
    while (!auctionEnded(h) && h.length < 30) { const call = recommend(hands[seat], seat, h); assert.ok(call, `${theme} ${h.map(e => e.call)}`); h.push(entry(hands[seat], seat, h, call)); seat = nextSeat(seat); }
    assert.ok(auctionEnded(h));
    if (theme === 'stayman') assert.equal(h.find(e => e.seat === 'S').call, '2C');
    if (theme === 'transfers') assert.ok(['2D', '2H'].includes(h.find(e => e.seat === 'S').call));
  }
});
test('random automatic auctions only emit legal calls and finish or explicitly stop', () => {
  for (let i = 0; i < 200; i++) {
    const hands = deal(seeded(i)); const h = []; let seat = SEATS[i % 4];
    for (let j = 0; j < 60; j++) { if (auctionEnded(h)) break; const call = recommend(hands[seat], seat, h); if (!call) break; assert.ok(legalCalls(h, seat).includes(call)); h.push(entry(hands[seat], seat, h, call)); seat = nextSeat(seat); }
    assert.ok(h.length < 60);
  }
});
test('board import validates deals, chronology and recomputes explanations', () => {
  const hands = deal(seeded(5));
  const b = { id: 'test', hands, dealer: 'N', vulnerability: 'none', history: [], systems: { NS: system, EW: system }, status: 'active' };
  const valid = validateBoard(b); assert.ok(validDeal(valid.hands));
  assert.throws(() => validateBoard({ ...b, history: [{ seat: 'S', call: '1C' }] }));
  assert.throws(() => validateBoard({ ...b, status: 'complete' }));
  assert.throws(() => validateBoard({ ...b, hands: { ...hands, S: hands.N } }));
  const imported = validateBoard({ ...b, history: [{ seat: 'N', call: 'P', meaning: { zh: '<script>evil</script>' } }] });
  assert.ok(!imported.history[0].meaning.zh.includes('<script>'));
  assert.deepEqual(decodeBoard(encodeBoard(valid)).hands, hands);
  assert.throws(() => validatePayload({ schema: 2, kind: 'board', board: b }));
});
