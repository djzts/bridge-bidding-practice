export const bilingual = (zh, en) => ({ zh, en });
export const DEFAULT_SYSTEM = {
  id: 'standard', name: '五张高花 · Five-card majors', version: 1,
  ntMin: 15, ntMax: 17, allowFiveMajor: false,
  conventions: ['stayman', 'transfers', 'weakTwo']
};
export const SAYC_SYSTEM = { id: 'sayc', name: 'SAYC · 标准美式核心', base: 'sayc', version: 1, ntMin: 15, ntMax: 17, allowFiveMajor: true, conventions: ['stayman', 'transfers', 'weakTwo', 'strong2c', 'jacoby2nt'] };
export const PRECISION_SYSTEM = { id: 'precision', name: '精确 · Precision 基础版', base: 'precision', version: 1, ntMin: 13, ntMax: 15, allowFiveMajor: false, conventions: ['stayman', 'transfers', 'weakTwo'] };
export const PRESETS = [DEFAULT_SYSTEM, SAYC_SYSTEM, PRECISION_SYSTEM];
export const systemBase = system => system.base || 'teaching';
export const baseName = system => ({ teaching: bilingual('五张高花教学体系', 'Five-card majors teaching system'), sayc: bilingual('SAYC 核心版', 'SAYC core'), precision: bilingual('精确基础版', 'Precision baseline') })[systemBase(system)];
export function systemScope(system) {
  if (systemBase(system) === 'precision') return bilingual('预设默认参数（编辑值以配置为准）：1♣ 16+；1♦ 11–15、至少两张；1♥/♠ 11–15、五张；1NT 13–15；2♣ 11–15、六张梅花或五张梅花带四张高花；2♦ 11–15、4414/4405（♠♥♦♣）；2NT 22–24。支持强梅花否定／积极应叫、部分自然后续和问叫。复杂接力、满贯与干扰后续尚未覆盖。', 'Preset defaults (edited configuration takes precedence): 1♣ 16+; 1♦ 11–15 with 2+ diamonds; 1♥/♠ 11–15 with five cards; 1NT 13–15; 2♣ 11–15 with six clubs or five clubs and a four-card major; 2♦ 11–15, 4414/4405 (♠♥♦♣); 2NT 22–24. Covers negative/positive strong-club responses and selected natural continuations and inquiries. Complex relays, slams and competitive continuations remain outside coverage.');
  if (systemBase(system) === 'sayc') return bilingual('SAYC 核心版预设默认参数：五张高花、较长低花；1NT 15–17（允许五张高花）、2NT 20–21、3NT 25–27；强 2♣ 与等待答叫；弱二 5–11；Jacoby 2NT 逼局加叫。仅用 HCP，不计算牌型点；常规开叫使用 13–21 HCP。垃圾 Stayman、超接受、满贯、复杂竞争及部分再叫仍未实现，不能等同完整 SAYC。修改参数后属于自定义 SAYC 变体。', 'SAYC core preset defaults: five-card majors, longer minor; 1NT 15–17 (five-card major allowed), 2NT 20–21, 3NT 25–27; strong 2♣ and waiting response; weak twos 5–11; Jacoby 2NT forcing raises. HCP only, without distribution points; normal openings use 13–21 HCP. Garbage Stayman, super-accepts, slams, complex competition and some rebids are not implemented: this is not full SAYC. Edited parameters create a custom SAYC variant.');
  return bilingual('五张高花教学体系：常规开叫 12–21 HCP、低花三张起。支持无将约定与简单自然叫牌。已启用模块按其说明生效；未覆盖的再叫、满贯和复杂竞争会明确停止。', 'Five-card-major teaching system: normal openings 12–21 HCP, three-card minors. Supports notrump conventions and simple natural bidding. Enabled modules apply as described; unimplemented rebids, slams and complex competition stop explicitly.');
}
export const CONVENTIONS = [
  { id: 'stayman', name: bilingual('斯台曼', 'Stayman'), group: 'nt', enabled: true, sequence: '1NT → 2♣', text: bilingual('询问四张高花。教学版本要求至少邀局实力；包含答叫、邀局与成局后续。', 'Asks for a four-card major. This teaching version requires invitational strength and covers replies, invitations and game continuations.'), conflicts: ['naturalClubs'], url: 'https://www.bridgebum.com/stayman.php' },
  { id: 'transfers', name: bilingual('雅各比转移叫', 'Jacoby transfers'), group: 'nt', enabled: true, sequence: '1NT → 2♦ / 2♥', text: bilingual('2♦ 转移至红心，2♥ 转移至黑桃，承诺五张以上。包含接受转移、止叫、邀局及成局；暂不支持超接受。', '2♦ transfers to hearts; 2♥ to spades, showing 5+ cards. Covers acceptance, signoff, invitations and game; no super-accepts.'), conflicts: ['naturalMajors'], url: 'https://www.bridgebum.com/jacoby_transfers.php' },
  { id: 'weakTwo', name: bilingual('弱二开叫', 'Weak two bids'), group: 'opening', enabled: true, sequence: '2♦ / 2♥ / 2♠', text: bilingual('六张套，至少两张 A/K/Q。教学版 6–10 HCP，SAYC 5–11；精确仅用于 2♥/♠，2♦ 保留短方块定义。支持简单止叫与高花成局，未实现特征问叫。', 'Six cards with two of A/K/Q. Teaching: 6–10 HCP; SAYC: 5–11. Precision uses only 2♥/♠; 2♦ retains its short-diamond meaning. Simple signoffs and major games only; no feature ask.'), conflicts: [], url: 'https://www.bridgebum.com/weak_two.php' },
  { id: 'naturalClubs', name: bilingual('自然 2♣ 止叫', 'Natural 2♣ signoff'), group: 'nt', enabled: true, sequence: '1NT → 2♣', text: bilingual('弱牌、六张以上梅花，要求停在 2♣。与相同进程的 Stayman 冲突。', 'A weak hand with 6+ clubs, to play in 2♣. Conflicts with Stayman in the same auction.'), conflicts: ['stayman'] },
  { id: 'naturalMajors', name: bilingual('自然二阶方块／高花止叫', 'Natural two-level suit signoffs'), group: 'nt', enabled: true, sequence: '1NT → 2♦ / 2♥ / 2♠', text: bilingual('弱牌、五张以上自然套。2♦ 和 2♥ 的含义与转移叫冲突。', 'Weak hands with a natural 5+ card suit. The meanings of 2♦ and 2♥ conflict with transfers.'), conflicts: ['transfers'] },
  { id: 'jacoby2nt', name: bilingual('雅各比 2NT', 'Jacoby 2NT'), group: 'raise', enabled: true, conflicts: [], bases: ['teaching', 'sayc'], sequence: '1♥ / 1♠ → 2NT', text: bilingual('未 Pass 过的应叫方以 13+ HCP、四张支持逼局加叫。支持短套／牌力答叫及简单成局；不覆盖后续满贯探索。仅限自然高花体系；精确的有限开叫另行定义。', 'An unpassed responder shows 13+ HCP and four-card support, forcing to game. Covers shortness/strength replies and simple game placement, not subsequent slam exploration. Available for natural-major systems; Precision limited openings need separate agreements.'), url: 'https://www.bridgebum.com/jacoby_2nt.php' },
  { id: 'negative', name: bilingual('负加倍', 'Negative doubles'), group: 'competition', sequence: '1♣ — (1♠) — X', text: bilingual('对手争叫后的技术性加倍；范围与后续需要搭档约定。', 'A takeout-oriented double after an overcall; range and continuations require partnership agreement.'), url: 'https://www.bridgebum.com/negative_double.php' },
  { id: 'michaels', name: bilingual('迈克尔斯扣叫', 'Michaels cuebid'), group: 'competition', sequence: '(1♥) → 2♥', text: bilingual('用扣叫描述特定双套牌，具体花色取决于对方开叫。', 'A cuebid describing a two-suited hand; the suits depend on the opposing opening.'), url: 'https://www.bridgebum.com/michaels_cuebid.php' },
  { id: 'rkcb', name: bilingual('罗马关键张问叫', 'Roman Key Card Blackwood'), group: 'slam', sequence: '4NT', text: bilingual('在将牌已约定的适用进程中询问关键张；1430 与 0314 答叫需要统一。', 'Asks for key cards in an agreed-trump context; partners must agree on 1430 or 0314 responses.'), url: 'https://www.bridgebum.com/roman_key_card_blackwood.php' },
  { id: 'strong2c', name: bilingual('强 2♣', 'Strong 2♣'), group: 'opening', enabled: true, conflicts: [], bases: ['teaching', 'sayc'], sequence: '2♣ → 2♦', text: bilingual('22+ HCP 人工强开叫；2♦ 等待。支持 22–24 均型再叫 2NT、部分自然积极答叫和成局后续。牌型强牌评估与满贯未覆盖。精确的 2♣ 为自然有限开叫，不能同时采用。', 'Artificial 22+ HCP opening; 2♦ waiting. Covers 22–24 balanced rebids, selected natural positives and game continuations. Playing-strength evaluation and slams are not covered. In Precision, 2♣ is natural and limited, so these treatments cannot coexist.'), url: 'https://www.bridgebum.com/strong_2_clubs.php' }
];
export const SYSTEM_LIBRARY = [
  { name: 'Five-card majors · Teaching', group: bilingual('自然五张高花', 'Natural five-card majors'), supported: true },
  { name: 'SAYC · Core', group: bilingual('自然五张高花 · 核心范围', 'Natural five-card majors · Core scope'), supported: true },
  { name: '2/1 Game Forcing', group: bilingual('自然五张高花', 'Natural five-card majors') },
  { name: 'Acol', group: bilingual('自然四张高花', 'Natural four-card majors') },
  { name: 'Precision Club · Baseline', group: bilingual('强梅花体系 · 基础范围', 'Strong club · Baseline scope'), supported: true },
  { name: 'Polish Club', group: bilingual('人工一梅花体系', 'Artificial one-club systems') }
];
export function validateSystem(system) {
  const errors = [];
  if (!system || typeof system.name !== 'string' || system.name.length < 1 || system.name.length > 100 || typeof system.id !== 'string' || system.id.length > 100 || !Number.isInteger(system.version) || system.version < 1) return [bilingual('体系文件格式无效。', 'Invalid system format.')];
  if (!['teaching', 'sayc', 'precision'].includes(systemBase(system))) errors.push(bilingual('未知基础体系。', 'Unknown base system.'));
  if (![[15, 17], [12, 14], [13, 15]].some(([min, max]) => system.ntMin === min && system.ntMax === max)) errors.push(bilingual('支持 15–17、12–14 或 13–15 无将范围。', 'Supported notrump ranges: 15–17, 12–14 or 13–15.'));
  if (systemBase(system) === 'precision' && system.ntMax > 15) errors.push(bilingual('精确的 16+ 手牌属于强 1♣ 范围，1NT 最高限不能超过 15。', 'Precision routes 16+ hands through strong 1♣; the 1NT maximum cannot exceed 15.'));
  if (typeof system.allowFiveMajor !== 'boolean' || !Array.isArray(system.conventions) || new Set(system.conventions).size !== system.conventions.length) return [...errors, bilingual('约定设置格式无效。', 'Invalid convention settings.')];
  for (const id of system.conventions) {
    const item = CONVENTIONS.find(c => c.id === id);
    if (!item?.enabled) { errors.push(bilingual('包含尚未支持的约定。', 'Includes an unsupported convention.')); continue; }
    if (item.bases && !item.bases.includes(systemBase(system))) errors.push(bilingual(`${item.name.zh} 与精确基础结构冲突：精确 2♣ 是有限自然开叫，高花开叫也限制在 11–15。`, `${item.name.en} conflicts with the Precision baseline: 2♣ is natural and limited, and major openings are limited to 11–15.`));
    for (const conflict of item.conflicts) if (system.conventions.includes(conflict) && id < conflict) {
      const other = CONVENTIONS.find(c => c.id === conflict);
      errors.push(bilingual(`${item.name.zh} 与 ${other.name.zh} 冲突：${item.sequence} 对同一叫品定义了不同含义。`, `${item.name.en} conflicts with ${other.name.en}: ${item.sequence} assigns different meanings to the same call.`));
    }
  }
  return errors;
}
