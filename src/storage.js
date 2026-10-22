import { DEFAULT_SYSTEM, validateSystem } from './systems.js';
import { validDeal, SEATS, nextSeat, legalCalls, auctionEnded } from './cards.js';
import { evaluate } from './engine.js';
export const STORAGE_KEY = 'bridge-studio-v01';
export const clone = value => structuredClone(value);
export const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function defaults() {
  return { schema: 1, language: 'zh', systems: [clone(DEFAULT_SYSTEM)], ns: 'standard', ew: 'standard', records: [], current: null,
    settings: { showHcp: true, showShape: false, visible: { N: false, E: false, W: false }, speed: 700, explainPartner: true, explainOpponents: true, autoFeedback: false } };
}
function validSystem(s) { if (validateSystem(s).length) throw new Error('system'); return clone(s); }
export function validateBoard(b) {
  if (!b || !validDeal(b.hands) || !SEATS.includes(b.dealer) || !['none', 'NS', 'EW', 'both'].includes(b.vulnerability) || !Array.isArray(b.history) || b.history.length > 100 || !['active', 'complete', 'stopped'].includes(b.status)) throw new Error('board');
  const systems = { NS: validSystem(b.systems?.NS), EW: validSystem(b.systems?.EW) };
  const history = [];
  let seat = b.dealer;
  for (const entry of b.history) {
    if (history.at(-1)?.rule === 'uncovered') throw new Error('unsupported continuation');
    if (entry.seat !== seat || !legalCalls(history, seat).includes(entry.call)) throw new Error('auction');
    history.push(evaluate({ hand: b.hands[seat], seat, history, system: systems[['N', 'S'].includes(seat) ? 'NS' : 'EW'] }, entry.call));
    seat = nextSeat(seat);
  }
  if (b.status === 'complete' && !auctionEnded(history)) throw new Error('auction');
  return { id: typeof b.id === 'string' && b.id.length <= 100 ? b.id : uid(), hands: clone(b.hands), dealer: b.dealer, vulnerability: b.vulnerability, systems, history,
    status: auctionEnded(history) ? 'complete' : history.at(-1)?.rule === 'uncovered' ? 'stopped' : b.status, theme: ['free', 'opening', 'nt', 'stayman', 'transfers'].includes(b.theme) ? b.theme : 'free',
    created: Number.isFinite(b.created) ? b.created : Date.now(), assisted: !!b.assisted, favorite: !!b.favorite, mistake: !!b.mistake,
    note: typeof b.note === 'string' ? b.note.slice(0, 1000) : '', stopReason: history.at(-1)?.rule === 'uncovered' ? 'userCall' : ['coverage', 'manual', 'userCall'].includes(b.stopReason) ? b.stopReason : 'manual' };
}
export function validatePayload(payload) {
  if (!payload || payload.schema !== 1) throw new Error('schema');
  if (payload.kind === 'system') return { kind: 'system', system: validSystem(payload.system) };
  if (payload.kind === 'board') return { kind: 'board', board: validateBoard(payload.board) };
  if (payload.kind !== 'backup' || !Array.isArray(payload.systems) || !payload.systems.length || payload.systems.length > 100 || !Array.isArray(payload.records) || payload.records.length > 500) throw new Error('backup');
  return { kind: 'backup', systems: payload.systems.map(validSystem), records: payload.records.map(validateBoard), current: payload.current ? validateBoard(payload.current) : null };
}
export function load() {
  const state = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state, error: false };
    const saved = JSON.parse(raw);
    const checked = validatePayload({ ...saved, kind: 'backup' });
    Object.assign(state, checked);
    state.language = saved.language === 'en' ? 'en' : 'zh';
    for (const key of ['ns', 'ew']) state[key] = state.systems.some(s => s.id === saved[key]) ? saved[key] : state.systems[0].id;
    for (const key of ['showHcp', 'showShape', 'explainPartner', 'explainOpponents', 'autoFeedback']) if (typeof saved.settings?.[key] === 'boolean') state.settings[key] = saved.settings[key];
    if ([0, 700, 1400].includes(saved.settings?.speed)) state.settings.speed = saved.settings.speed;
    for (const s of ['N', 'E', 'W']) state.settings.visible[s] = saved.settings?.visible?.[s] === true;
    return { state, error: false };
  } catch { return { state, error: true }; }
}
export function persist(state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function encodeBoard(board) {
  // Explanations are regenerated on import. Keeping only calls makes links short
  // and prevents external text from being treated as authoritative reasoning.
  const compact = { ...board, history: board.history.map(({ seat, call }) => ({ seat, call })) };
  const bytes = new TextEncoder().encode(JSON.stringify({ schema: 1, kind: 'board', board: compact }));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decodeBoard(value) {
  if (value.length > 60000) throw new Error('size');
  const raw = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  return validatePayload(JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))))).board;
}
