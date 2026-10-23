import test from 'node:test';
import assert from 'node:assert/strict';
import { deal, SEATS, nextSeat, legalCalls, auctionEnded, contract } from '../src/cards.js';
import { decide, evaluate } from '../src/engine.js';
import { PRESETS } from '../src/systems.js';
import { validateBoard, encodeBoard, decodeBoard } from '../src/storage.js';

function random(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test('random deals complete legally for every preset pairing and dealer', () => {
  let fallbacks = 0, maxCalls = 0;
  for (const ns of PRESETS) for (const ew of PRESETS) for (const dealer of SEATS) {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = random(seed * 97 + SEATS.indexOf(dealer));
      const hands = deal(rng), history = [];
      let seat = dealer;
      while (!auctionEnded(history) && history.length < 512) {
        const ctx = { hand: hands[seat], seat, history, system: ['N', 'S'].includes(seat) ? ns : ew, completeAuction: true };
        const recommended = decide(ctx).recommended;
        assert.ok(recommended, `missing decision: ${ns.id}/${ew.id}/${seat}`);
        assert.ok(legalCalls(history, seat).includes(recommended.call));
        // Exercise unsupported South decisions as well as suggested auctions.
        const legal = legalCalls(history, seat);
        const call = seat === 'S' && seed % 3 === 0 && rng() < .3 ? legal[Math.floor(rng() * legal.length)] : recommended.call;
        const entry = evaluate(ctx, call);
        if (recommended.fallback) {
          fallbacks++;
          assert.equal(entry.feedback, 'ungraded');
          assert.equal(entry.expected, null);
        }
        history.push(entry);
        seat = nextSeat(seat);
      }
      assert.ok(auctionEnded(history), `did not finish seed ${seed}`);
      maxCalls = Math.max(maxCalls, history.length);
      const board = { id: 'continuation', hands, history, systems: { NS: ns, EW: ew }, dealer, vulnerability: 'none', theme: 'free', status: 'complete' };
      const restored = validateBoard(board);
      assert.equal(restored.status, 'complete');
      assert.deepEqual(contract(restored.history), contract(history));
      assert.deepEqual(restored.history.map(e => e.feedback), history.map(e => e.feedback));
      if (seed === 1) assert.equal(decodeBoard(encodeBoard(board)).status, 'complete');
    }
  }
  assert.ok(fallbacks > 0, 'must exercise missing teaching continuations');
  assert.ok(maxCalls < 512);
});

test('the reported competitive auction gets an automatic East decision', () => {
  const system = PRESETS[0];
  const hand = (...suits) => suits.flatMap((ranks, i) => [...ranks].map(r => ['S', 'H', 'C', 'D'][i] + r));
  const history = [
    { seat: 'W', call: '1C', rule: 'openSuit', suit: 'C', min: 12, max: 21 },
    { seat: 'N', call: '1S', rule: 'overcall', suit: 'S', min: 8, max: 16 }
  ];
  const ctx = { hand: hand('3', '962', 'AT', 'KQJ9653'), seat: 'E', history, system, completeAuction: true };
  const decision = decide(ctx).recommended;
  assert.ok(decision?.fallback);
  assert.equal(decision.call, '2D');
  assert.equal(evaluate(ctx, decision.call).feedback, 'ungraded');
  assert.equal(decide({ ...ctx, completeAuction: false }).recommended, null);
});
