import { analyze, bidValue, legalCalls, partner, sameSide, SUITS, SYMBOLS } from './cards.js';
import { bilingual as bi, systemBase } from './systems.js';

// A conservative natural continuation, using only this hand and public calls.
// These estimates are a playing policy, never an additional system agreement.
export function naturalContinuation({ hand, seat, history, system }) {
  const { hcp, lengths, balanced } = analyze(hand);
  const legal = legalCalls(history, seat);
  const bids = history.filter(e => bidValue(e.call) >= 0);
  const own = bids.filter(e => e.seat === seat);
  const mate = bids.filter(e => e.seat === partner(seat));
  const last = bids.at(-1);
  const natural = e => e.suit && SUITS.includes(e.suit) && !e.alert;
  const mateSuit = mate.findLast(natural)?.suit;
  const mateMin = Math.max(0, ...mate.map(e => Number.isFinite(e.min) ? e.min : 0));
  const total = hcp + mateMin;
  const longest = [...SUITS].sort((a, b) => lengths[b] - lengths[a]);
  const result = (call, zh, en, meta = {}) => ({
    call, fits: true, rule: 'naturalContinuation', fallback: true,
    meaning: bi(`自然续叫策略（非约定评分）：${zh}`, `Natural continuation policy (ungraded): ${en}`),
    ...meta
  });
  const bidSuit = (suit, maxLevel, minLength) => legal.find(call =>
    call.endsWith(suit) && Number(call[0]) <= maxLevel && lengths[suit] >= minLength);
  const pass = () => result('P', '根据本手和公开叫牌，保守接受当前局面。', 'Conservatively accept the current position using this hand and the public auction.');

  // If an unusual user opening has no implemented definition, avoid guessing
  // its convention. Only use suits explicitly shown by a natural call.
  if (last && sameSide(last.seat, seat)) {
    if (mateSuit && lengths[mateSuit] >= 3 && last.call.slice(1) === mateSuit) {
      const gameLevel = ['H', 'S'].includes(mateSuit) ? 4 : 5;
      const target = total >= 37 ? 7 : total >= 33 ? 6 : total >= (gameLevel === 4 ? 25 : 28) ? gameLevel : total >= 23 ? 3 : total >= 19 ? 2 : 1;
      const call = legal.find(c => c === target + mateSuit);
      if (call) return result(call, `支持搭档的自然${SYMBOLS[mateSuit]}套；公开最低点力估计合计 ${total} HCP。`, `Support partner's natural ${SYMBOLS[mateSuit]} suit; estimated combined minimum ${total} HCP.`, { suit: mateSuit, min: Math.min(16, Math.floor(hcp / 4) * 4) });
    }
    if (balanced && mateMin && total >= 25 && legal.includes('3NT')) {
      return result('3NT', '均型牌，依据公开点力估计选择无将成局。', 'With a balanced hand, choose notrump game based on publicly shown strength.', { min: Math.min(16, Math.floor(hcp / 4) * 4), terminal: true });
    }
    // Show one new long suit rather than passing every missing response.
    if (!own.length && hcp >= 6) for (const suit of longest) {
      if (mate.some(e => natural(e) && e.suit === suit)) continue;
      const call = bidSuit(suit, hcp >= 10 ? 2 : 1, 5);
      if (call) return result(call, `自然显示五张以上${SYMBOLS[suit]}。`, `Naturally show 5+ ${SYMBOLS[suit]}.`, { suit, min: Math.min(16, Math.floor(hcp / 4) * 4) });
    }
    if (last.seat === partner(seat) && last.forcing && !own.length) {
      const call = legal.find(c => /^\dNT$/.test(c) && Number(c[0]) <= 3);
      if (call) return result(call, '对搭档逼叫作出保守无将应叫；不赋予额外约定含义。', 'Give a conservative notrump response to partner\'s forcing call without assigning an additional convention.', { min: Math.min(16, Math.floor(hcp / 4) * 4) });
    }
    return pass();
  }

  // Raise an explicitly natural fit, or enter once with a sound long suit.
  if (mateSuit && lengths[mateSuit] >= 3 && total >= 20) {
    const maxLevel = total >= 25 && ['H', 'S'].includes(mateSuit) ? 4 : 3;
    const call = bidSuit(mateSuit, maxLevel, 3);
    if (call && (!own.length || total >= 25)) return result(call, `竞争性支持搭档的${SYMBOLS[mateSuit]}套。`, `Compete in partner's ${SYMBOLS[mateSuit]} suit.`, { suit: mateSuit, min: Math.min(16, Math.floor(hcp / 4) * 4) });
  }
  if (!own.length && hcp >= 10) for (const suit of longest) {
    const call = bidSuit(suit, hcp >= 16 ? 3 : 2, 6);
    if (call) return result(call, `以六张以上${SYMBOLS[suit]}作自然争叫。`, `Make a natural overcall with 6+ ${SYMBOLS[suit]}.`, { suit, min: Math.min(16, Math.floor(hcp / 4) * 4) });
  }
  if (!last && hcp >= (systemBase(system) === 'precision' ? 11 : 12)) {
    const suit = longest[0], call = bidSuit(suit, 1, 3);
    if (call) return result(call, '按最长套作自然开叫。', 'Open naturally in the longest suit.', { suit, min: Math.min(16, Math.floor(hcp / 4) * 4) });
  }
  return pass();
}
