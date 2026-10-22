export const SEATS = ['N', 'E', 'S', 'W'];
export const SUITS = ['S', 'H', 'C', 'D'];
export const STRAINS = ['C', 'D', 'H', 'S', 'NT'];
export const SYMBOLS = { S: '♠', H: '♥', C: '♣', D: '♦', NT: 'NT' };
export const RANKS = 'AKQJT98765432';
export const deck = () => SUITS.flatMap(s => [...RANKS].map(r => s + r));
export const partner = seat => SEATS[(SEATS.indexOf(seat) + 2) % 4];
export const sameSide = (a, b) => a === b || partner(a) === b;
export const nextSeat = seat => SEATS[(SEATS.indexOf(seat) + 1) % 4];
export function analyze(hand) {
  const lengths = Object.fromEntries(SUITS.map(s => [s, hand.filter(c => c[0] === s).length]));
  const shape = Object.values(lengths).sort((a, b) => b - a).join('');
  return { hcp: hand.reduce((n, c) => n + ({ A: 4, K: 3, Q: 2, J: 1 }[c[1]] || 0), 0), lengths, balanced: ['4333', '4432', '5332'].includes(shape) };
}
export const sortHand = hand => [...hand].sort((a, b) => SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]) || RANKS.indexOf(a[1]) - RANKS.indexOf(b[1]));
export function deal(rng = Math.random) {
  const cards = deck();
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return Object.fromEntries(SEATS.map((s, i) => [s, sortHand(cards.slice(i * 13, i * 13 + 13))]));
}
export function validDeal(hands) {
  if (!hands || !SEATS.every(s => Array.isArray(hands[s]) && hands[s].length === 13)) return false;
  const cards = SEATS.flatMap(s => hands[s]);
  const allowed = new Set(deck());
  return new Set(cards).size === 52 && cards.every(c => allowed.has(c));
}
export function bidValue(call) { const match = /^([1-7])(C|D|H|S|NT)$/.exec(call); return match ? (+match[1] - 1) * 5 + STRAINS.indexOf(match[2]) : -1; }
export const callText = call => call === 'P' ? 'Pass' : call === 'X' ? '×' : call === 'XX' ? '××' : call.replace(/NT|[CDHS]/, s => SYMBOLS[s]);
export function auctionEnded(history) {
  if (history.length < 4) return false;
  return history.some(e => bidValue(e.call) >= 0) ? history.slice(-3).every(e => e.call === 'P') : history.slice(-4).every(e => e.call === 'P');
}
export function legalCalls(history, seat) {
  if (auctionEnded(history)) return [];
  const lastBid = history.findLast(e => bidValue(e.call) >= 0);
  const lastAction = history.findLast(e => e.call !== 'P');
  const calls = ['P'];
  if (lastAction && lastAction.call !== 'XX') {
    if (bidValue(lastAction.call) >= 0 && !sameSide(lastAction.seat, seat)) calls.push('X');
    if (lastAction.call === 'X' && lastBid && sameSide(lastBid.seat, seat)) calls.push('XX');
  }
  for (let level = 1; level <= 7; level++) for (const strain of STRAINS) {
    const call = level + strain;
    if (bidValue(call) > (lastBid ? bidValue(lastBid.call) : -1)) calls.push(call);
  }
  return calls;
}
export function contract(history) {
  const last = history.findLast(e => bidValue(e.call) >= 0);
  if (!last) return null;
  const strain = last.call.slice(1);
  const declarer = history.find(e => bidValue(e.call) >= 0 && e.call.slice(1) === strain && sameSide(e.seat, last.seat)).seat;
  const action = history.findLast(e => e.call !== 'P');
  return { call: last.call, declarer, doubled: action.call === 'X' ? '×' : action.call === 'XX' ? '××' : '' };
}
