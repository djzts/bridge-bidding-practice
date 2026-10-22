export const bilingual = (zh, en) => ({ zh, en });
export const DEFAULT_SYSTEM = {
  id: 'standard', name: '五张高花 · Five-card majors', version: 1,
  ntMin: 15, ntMax: 17, allowFiveMajor: false,
  conventions: ['stayman', 'transfers', 'weakTwo']
};
export const CONVENTIONS = [
  { id: 'stayman', name: bilingual('斯台曼', 'Stayman'), group: 'nt', enabled: true, sequence: '1NT → 2♣', text: bilingual('询问四张高花。教学版本要求至少邀局实力；包含答叫、邀局与成局后续。', 'Asks for a four-card major. This teaching version requires invitational strength and covers replies, invitations and game continuations.'), conflicts: ['naturalClubs'], url: 'https://www.bridgebum.com/stayman.php' },
  { id: 'transfers', name: bilingual('雅各比转移叫', 'Jacoby transfers'), group: 'nt', enabled: true, sequence: '1NT → 2♦ / 2♥', text: bilingual('2♦ 转移至红心，2♥ 转移至黑桃，承诺五张以上。包含接受转移、止叫、邀局及成局；暂不支持超接受。', '2♦ transfers to hearts; 2♥ to spades, showing 5+ cards. Covers acceptance, signoff, invitations and game; no super-accepts.'), conflicts: ['naturalMajors'], url: 'https://www.bridgebum.com/jacoby_transfers.php' },
  { id: 'weakTwo', name: bilingual('弱二开叫', 'Weak two bids'), group: 'opening', enabled: true, sequence: '2♦ / 2♥ / 2♠', text: bilingual('本预设为 6–10 HCP、六张套且至少两张 A/K/Q。支持 Pass 与高花直接成局；复杂问叫暂未覆盖。', 'This preset uses 6–10 HCP, a six-card suit and two of A/K/Q. Pass and direct major games are covered; asking sequences are not.'), conflicts: [], url: 'https://www.bridgebum.com/weak_two.php' },
  { id: 'naturalClubs', name: bilingual('自然 2♣ 止叫', 'Natural 2♣ signoff'), group: 'nt', enabled: true, sequence: '1NT → 2♣', text: bilingual('弱牌、六张以上梅花，要求停在 2♣。与相同进程的 Stayman 冲突。', 'A weak hand with 6+ clubs, to play in 2♣. Conflicts with Stayman in the same auction.'), conflicts: ['stayman'] },
  { id: 'naturalMajors', name: bilingual('自然二阶方块／高花止叫', 'Natural two-level suit signoffs'), group: 'nt', enabled: true, sequence: '1NT → 2♦ / 2♥ / 2♠', text: bilingual('弱牌、五张以上自然套。2♦ 和 2♥ 的含义与转移叫冲突。', 'Weak hands with a natural 5+ card suit. The meanings of 2♦ and 2♥ conflict with transfers.'), conflicts: ['transfers'] },
  { id: 'jacoby2nt', name: bilingual('雅各比 2NT', 'Jacoby 2NT'), group: 'raise', sequence: '1♥ / 1♠ → 2NT', text: bilingual('高花开叫后的逼局加叫，与无将后的转移叫是不同约定。', 'A game-forcing raise of a major opening, distinct from transfers over notrump.'), url: 'https://www.bridgebum.com/jacoby_2nt.php' },
  { id: 'negative', name: bilingual('负加倍', 'Negative doubles'), group: 'competition', sequence: '1♣ — (1♠) — X', text: bilingual('对手争叫后的技术性加倍；范围与后续需要搭档约定。', 'A takeout-oriented double after an overcall; range and continuations require partnership agreement.'), url: 'https://www.bridgebum.com/negative_double.php' },
  { id: 'michaels', name: bilingual('迈克尔斯扣叫', 'Michaels cuebid'), group: 'competition', sequence: '(1♥) → 2♥', text: bilingual('用扣叫描述特定双套牌，具体花色取决于对方开叫。', 'A cuebid describing a two-suited hand; the suits depend on the opposing opening.'), url: 'https://www.bridgebum.com/michaels_cuebid.php' },
  { id: 'rkcb', name: bilingual('罗马关键张问叫', 'Roman Key Card Blackwood'), group: 'slam', sequence: '4NT', text: bilingual('在将牌已约定的适用进程中询问关键张；1430 与 0314 答叫需要统一。', 'Asks for key cards in an agreed-trump context; partners must agree on 1430 or 0314 responses.'), url: 'https://www.bridgebum.com/roman_key_card_blackwood.php' },
  { id: 'strong2c', name: bilingual('强 2♣', 'Strong 2♣'), group: 'opening', sequence: '2♣', text: bilingual('强牌的人工开叫。等待答叫和后续尚未实现，遇到此类强牌会提示超出范围。', 'An artificial strong opening. Waiting responses and rebids are not yet implemented; these hands are flagged as outside coverage.'), url: 'https://www.bridgebum.com/strong_2_clubs.php' }
];
export const SYSTEM_LIBRARY = [
  { name: 'Five-card majors · Teaching', group: bilingual('自然五张高花', 'Natural five-card majors'), supported: true },
  { name: 'Standard American / SAYC', group: bilingual('自然五张高花', 'Natural five-card majors') },
  { name: '2/1 Game Forcing', group: bilingual('自然五张高花', 'Natural five-card majors') },
  { name: 'Acol', group: bilingual('自然四张高花', 'Natural four-card majors') },
  { name: 'Precision Club', group: bilingual('强梅花体系', 'Strong club systems') },
  { name: 'Polish Club', group: bilingual('人工一梅花体系', 'Artificial one-club systems') }
];
export function validateSystem(system) {
  const errors = [];
  if (!system || typeof system.name !== 'string' || system.name.length < 1 || system.name.length > 100 || typeof system.id !== 'string' || system.id.length > 100 || !Number.isInteger(system.version) || system.version < 1) return [bilingual('体系文件格式无效。', 'Invalid system format.')];
  if (![[15, 17], [12, 14]].some(([min, max]) => system.ntMin === min && system.ntMax === max)) errors.push(bilingual('V0.1 支持 15–17 或 12–14 无将范围。', 'V0.1 supports 15–17 or 12–14 notrump ranges.'));
  if (typeof system.allowFiveMajor !== 'boolean' || !Array.isArray(system.conventions) || new Set(system.conventions).size !== system.conventions.length) return [...errors, bilingual('约定设置格式无效。', 'Invalid convention settings.')];
  for (const id of system.conventions) {
    const item = CONVENTIONS.find(c => c.id === id);
    if (!item?.enabled) { errors.push(bilingual('包含尚未支持的约定。', 'Includes an unsupported convention.')); continue; }
    for (const conflict of item.conflicts) if (system.conventions.includes(conflict) && id < conflict) {
      const other = CONVENTIONS.find(c => c.id === conflict);
      errors.push(bilingual(`${item.name.zh} 与 ${other.name.zh} 冲突：${item.sequence} 对同一叫品定义了不同含义。`, `${item.name.en} conflicts with ${other.name.en}: ${item.sequence} assigns different meanings to the same call.`));
    }
  }
  return errors;
}
