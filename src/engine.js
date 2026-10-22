import { analyze, bidValue, legalCalls, partner, sameSide, SUITS, SYMBOLS, deal } from './cards.js';
import { bilingual as bi } from './systems.js';

// The decision API deliberately accepts ONE hand. Other hands never enter a decision.
export function choices({ hand, seat, history, system }) {
  const { hcp: p, lengths: l, balanced } = analyze(hand);
  const legal = legalCalls(history, seat);
  const result = [];
  const add = (call, fits, rule, zh, en, meta = {}) => result.push({ call, fits, rule, meaning: bi(zh, en), ...meta });
  const pass = (fits, zh = '止叫；没有继续叫牌的需要。', en = 'Sign off; no further bid is needed.') => add('P', fits, 'pass', zh, en);
  const finish = () => result.filter(c => legal.includes(c.call));
  const has = id => system.conventions.includes(id);
  const suitName = s => SYMBOLS[s];
  const invite = 25 - system.ntMax, game = 25 - system.ntMin, slam = 33 - system.ntMax;
  const actions = history.filter(e => e.call !== 'P');
  const opening = actions[0];
  const ours = actions.filter(e => sameSide(e.seat, seat));
  const theirs = actions.filter(e => !sameSide(e.seat, seat));
  const own = ours.filter(e => e.seat === seat);
  const mate = ours.filter(e => e.seat === partner(seat));
  const last = ours.at(-1);
  const longest = [...SUITS].sort((a, b) => l[b] - l[a] || ['S', 'H', 'D', 'C'].indexOf(a) - ['S', 'H', 'D', 'C'].indexOf(b));

  if (!opening) {
    const ntShape = balanced && (system.allowFiveMajor || (l.H < 5 && l.S < 5));
    add('1NT', ntShape && p >= system.ntMin && p <= system.ntMax, 'openNT', `${system.ntMin}–${system.ntMax} HCP，均型${system.allowFiveMajor ? '；允许五张高花' : '，无五张高花'}。`, `${system.ntMin}–${system.ntMax} HCP, balanced${system.allowFiveMajor ? '; a five-card major is allowed' : ', no five-card major'}.`, { min: system.ntMin, max: system.ntMax });
    for (const s of ['S', 'H']) add('1' + s, p >= 12 && p <= 21 && l[s] >= 5 && l[s] === Math.max(l.S, l.H) && !(s === 'H' && l.S === l.H), 'openSuit', `12–21 HCP，至少五张${suitName(s)}。双高花等长时先叫黑桃。`, `12–21 HCP and 5+ ${suitName(s)}. With equal major lengths, open spades.`, { suit: s, min: 12, max: 21 });
    const minor = l.D > l.C || (l.D === l.C && l.D >= 4) ? 'D' : 'C';
    for (const s of ['D', 'C']) add('1' + s, p >= 12 && p <= 21 && l.H < 5 && l.S < 5 && minor === s, 'openSuit', `12–21 HCP，至少三张${suitName(s)}；优先较长低花，3–3 先梅花，4–4 先方块。`, `12–21 HCP and 3+ ${suitName(s)}; longer minor, clubs with 3–3, diamonds with 4–4.`, { suit: s, min: 12, max: 21 });
    if (has('weakTwo')) for (const s of ['S', 'H', 'D']) add('2' + s, p >= 6 && p <= 10 && l[s] === 6 && hand.filter(c => c[0] === s && 'AKQ'.includes(c[1])).length >= 2, 'weakTwo', `6–10 HCP，六张${suitName(s)}且含至少两张 A/K/Q。`, `6–10 HCP, six ${suitName(s)} with at least two of A/K/Q.`, { suit: s, min: 6, max: 10 });
    pass(p < 12, '不足常规开叫实力；若满足弱二条件，优先考虑弱二。', 'Below normal opening strength; prefer a weak two when its requirements are met.');
    return finish();
  }

  // Limited natural defense. Stronger unhandled defensive hands stop explicitly.
  if (!ours.length) {
    if (opening.rule === 'openSuit' && actions.length === 1) {
      for (const s of longest) add('1' + s, p >= 8 && p <= 16 && l[s] >= 5 && hand.some(c => c[0] === s && 'AKQ'.includes(c[1])), 'overcall', `自然一阶争叫：8–16 HCP，五张以上${suitName(s)}且有大牌。`, `Natural one-level overcall: 8–16 HCP, 5+ ${suitName(s)} with a top honor.`, { suit: s, min: 8, max: 16 });
    }
    pass(p < 12 && (opening.rule !== 'openNT' || p < 10), '本教学防守策略下不参与竞争；不承诺特定牌型。', 'No action under this teaching defensive policy; no specific shape is promised.');
    return finish();
  }

  // Once both sides bid, only simple competitive raises and signoffs are covered.
  if (theirs.length) {
    if (last?.seat === partner(seat) && last.suit && !own.length && ['openSuit', 'overcall'].includes(last.rule)) {
      const s = last.suit, level = Math.floor((bidValue(actions.at(-1).call) + 5 - ['C', 'D', 'H', 'S', 'NT'].indexOf(s)) / 5) + 1;
      if (level <= 3) add(level + s, p >= 6 && p <= 10 && l[s] >= (['H', 'S'].includes(s) ? 3 : 5), 'competitiveRaise', `自然竞争性加叫：6–10 HCP，${['H', 'S'].includes(s) ? '三' : '五'}张以上支持。`, `Natural competitive raise: 6–10 HCP and ${['H', 'S'].includes(s) ? '3' : '5'}+ card support.`, { suit: s, min: 6, max: 10 });
    }
    pass((!own.length && p < 6) || (own.length > 0 && p <= 14), '已表达实力或缺少竞争实力，本轮不再竞叫。', 'Values have been shown, or there is insufficient strength to compete further.');
    return finish();
  }

  if (last?.seat === seat) { pass(true, '搭档已 Pass，接受当前定约。', 'Partner has passed; accept the current contract.'); return finish(); }

  if (opening.rule === 'openNT') {
    const responder = partner(opening.seat);
    if (ours.length === 1 && seat === responder) {
      if (has('transfers')) for (const s of ['S', 'H']) add(s === 'S' ? '2H' : '2D', l[s] >= 5 && l[s] === Math.max(l.S, l.H) && p < slam, 'transfer', `转移叫：至少五张${suitName(s)}，要求开叫者叫${suitName(s)}；点力不限。`, `Transfer: 5+ ${suitName(s)}, asking opener to bid ${suitName(s)}; unrestricted strength.`, { suit: s, alert: true, forcing: true });
      if (has('stayman')) add('2C', p >= invite && p < slam && (l.H >= 4 || l.S >= 4), 'stayman', `斯台曼：至少 ${invite} HCP，询问四张高花。本教学版本承诺至少一门四张高花。`, `Stayman: ${invite}+ HCP, asking for a four-card major. This teaching version promises a four-card major.`, { alert: true, forcing: true });
      if (has('naturalClubs')) add('2C', p < invite && l.C >= 6, 'signoff', '自然止叫：六张以上梅花，低于邀局实力。', 'Natural signoff: 6+ clubs and less than invitational strength.', { suit: 'C', terminal: true });
      if (has('naturalMajors')) for (const s of ['S', 'H', 'D']) add('2' + s, p < invite && l[s] >= 5, 'signoff', `自然止叫：五张以上${suitName(s)}，低于邀局实力。`, `Natural signoff: 5+ ${suitName(s)} and less than invitational strength.`, { suit: s, terminal: true });
      add('3NT', p >= game && p < slam && l.H < 5 && l.S < 5, 'ntGame', `${game}+ HCP，选择无将成局；仍有高花配合可能时先探索。`, `${game}+ HCP, choosing game in notrump; explore a possible major fit first.`, { terminal: true });
      add('2NT', p >= invite && p < game && l.H < 5 && l.S < 5, 'ntInvite', `${invite}–${game - 1} HCP，邀叫 3NT。`, `${invite}–${game - 1} HCP, inviting 3NT.`);
      pass(p < invite, '低于邀局实力，停在 1NT；有可用弱牌长套方案时优先考虑。', 'Below invitational strength; play 1NT unless a supported weak long-suit action is preferable.');
      return finish();
    }
    if (last.rule === 'transfer') { const s = last.suit; add('2' + s, true, 'transferAccept', `接受转移至${suitName(s)}；不额外承诺将牌长度。`, `Accept the transfer to ${suitName(s)}; no additional trump length is promised.`, { suit: s }); return finish(); }
    if (last.rule === 'stayman') {
      add('2H', l.H >= 4, 'staymanReply', '至少四张红心，可能还有四张黑桃。', '4+ hearts; may also hold four spades.', { suit: 'H' });
      add('2S', l.S >= 4 && l.H < 4, 'staymanReply', '至少四张黑桃，否认四张红心。', '4+ spades, denying four hearts.', { suit: 'S' });
      add('2D', l.H < 4 && l.S < 4, 'staymanReply', '否认四张高花；方块为人工答叫。', 'Denies a four-card major; diamonds are artificial.', { suit: 'D', alert: true }); return finish();
    }
    if (last.rule === 'transferAccept') {
      const s = last.suit;
      // A second four-card major needs a separate continuation, not a blind NT
      // placement that could miss a fit in that second suit.
      if (l[s === 'S' ? 'H' : 'S'] >= 4) return [];
      pass(p < invite, '转移后的弱牌止叫。', 'Weak signoff after the transfer.');
      add('4' + s, l[s] >= 6 && p >= game && p < slam, 'majorGame', `六张以上${suitName(s)}，成局实力，确定八张配合。`, `6+ ${suitName(s)} and game values, establishing an eight-card fit.`, { terminal: true, suit: s });
      add('3' + s, l[s] >= 6 && p >= invite && p < game, 'majorInvite', `六张以上${suitName(s)}，邀请高花成局。`, `6+ ${suitName(s)}, inviting game in the major.`, { suit: s });
      add('3NT', l[s] === 5 && p >= game && p < slam, 'transferGame', `恰好五张${suitName(s)}、成局实力；让搭档选择无将或高花。`, `Exactly five ${suitName(s)} and game values; opener chooses notrump or the major.`, { suit: s });
      add('2NT', l[s] === 5 && p >= invite && p < game, 'transferInvite', `恰好五张${suitName(s)}、邀局实力；让搭档选择花色与阶数。`, `Exactly five ${suitName(s)} and invitational values; opener chooses strain and level.`, { suit: s }); return finish();
    }
    if (last.rule === 'staymanReply') {
      const s = last.suit, fit = s !== 'D' && l[s] >= 4;
      if (s !== 'D') {
        add('4' + s, fit && p >= game && p < slam, 'majorGame', '已找到四四高花配合，具有成局实力。', 'A four-four major fit and game values.', { suit: s, terminal: true });
        add('3' + s, fit && p >= invite && p < game, 'majorInvite', '已找到四四高花配合，邀请成局。', 'A four-four major fit; inviting game.', { suit: s });
      }
      add('3NT', !fit && p >= game && p < slam && l.S < 5 && l.H < 5, 'staymanNTGame', '没有找到已显示高花的配合，选择 3NT。', 'No fit for the shown major; choose 3NT.', { otherMajor: s === 'H' ? 'S' : null });
      add('2NT', !fit && p >= invite && p < game && l.S < 5 && l.H < 5, 'staymanNTInvite', '没有找到已显示高花的配合，邀请 3NT。', 'No fit for the shown major; invite 3NT.', { otherMajor: s === 'H' ? 'S' : null }); return finish();
    }
    if (last.rule === 'transferGame') {
      add('4' + last.suit, l[last.suit] >= 3, 'majorGame', '至少三张支持，选择八张配合的高花成局。', '3+ card support; choose game in the eight-card major fit.', { terminal: true, suit: last.suit });
      pass(l[last.suit] < 3, '只有两张支持，保留 3NT。', 'Only two-card support; retain 3NT.'); return finish();
    }
    if (['ntInvite', 'transferInvite', 'majorInvite', 'staymanNTInvite', 'staymanNTGame'].includes(last.rule)) {
      const maximum = p === system.ntMax;
      const s = last.suit || last.otherMajor;
      const fit = s && l[s] >= (last.rule === 'transferInvite' ? 3 : last.rule === 'majorInvite' ? 2 : 4);
      const alreadyGame = last.rule === 'staymanNTGame';
      if (s) {
        add('4' + s, fit && (maximum || alreadyGame), 'majorGame', '具备高花配合，接受邀局或选择高花成局。', 'With a major fit, accept the invitation or choose game in the major.', { terminal: true, suit: s });
        if (!alreadyGame && last.rule !== 'majorInvite') add('3' + s, fit && !maximum, 'signoff', '有高花配合但未达最高限，选择部分定约。', 'A major fit but not maximum strength; choose a partscore.', { terminal: true, suit: s });
      }
      if (!alreadyGame && last.rule !== 'majorInvite') add('3NT', !fit && maximum, 'ntGame', '无将范围最高限，接受邀局。', 'Maximum of the notrump range; accept the invitation.', { terminal: true });
      pass(alreadyGame ? !fit : (!maximum && (!fit || last.rule === 'majorInvite')), alreadyGame ? '保留 3NT。' : '未达最高限，拒绝邀局。', alreadyGame ? 'Retain 3NT.' : 'Not maximum; decline the invitation.'); return finish();
    }
    if (last.terminal || last.rule === 'pass') { pass(true); return finish(); }
    return [];
  }

  if (opening.rule === 'weakTwo') {
    if (last.terminal) { pass(true); return finish(); }
    if (!own.length) {
      const s = opening.suit;
      if (['H', 'S'].includes(s)) add('4' + s, p >= 15 && p <= 18 && l[s] >= 3, 'majorGame', '至少三张支持、15–18 HCP，教学策略选择高花成局。', '3+ card support and 15–18 HCP; this teaching policy chooses game.', { terminal: true, suit: s });
      pass(p <= 14, '在本弱二教学范围内，选择停叫。', 'Within this weak-two teaching scope, choose to pass.');
    }
    return finish();
  }

  if (opening.rule === 'openSuit') {
    const s = opening.suit, major = ['H', 'S'].includes(s), support = major ? 3 : 5;
    if (ours.length === 1) {
      if (major) {
        add('4' + s, p >= 13 && p <= 15 && l[s] >= 4, 'majorGame', '教学自然加叫：13–15 HCP，至少四张将牌，直接成局。', 'Teaching natural raise: 13–15 HCP and 4+ trumps; bid game.', { terminal: true, suit: s });
        add('3' + s, p >= 10 && p <= 12 && l[s] >= 3, 'limitRaise', '10–12 HCP，至少三张支持，限制性邀局加叫。', '10–12 HCP and 3+ card support; a limit raise.', { suit: s });
      }
      add('2' + s, p >= 6 && p <= 9 && l[s] >= support, 'simpleRaise', `6–9 HCP，至少${support}张支持，单加叫。`, `6–9 HCP and ${support}+ card support; a simple raise.`, { suit: s });
      const responseSuits = ['H', 'S'].sort((a, b) => l[b] - l[a]).concat('D');
      for (const t of responseSuits) if (t !== s) add('1' + t, p >= 6 && p <= 18 && l[t] >= 4, 'newSuit', `6+ HCP，至少四张${suitName(t)}，逼叫一轮。高花四四先红心。`, `6+ HCP and 4+ ${suitName(t)}, forcing one round. Bid hearts first with four-four majors.`, { forcing: true, suit: t });
      add('1NT', p >= 6 && p <= 9, 'suitNT', '6–9 HCP，不能在一阶显示高花，非逼叫。', '6–9 HCP, no available one-level major response; nonforcing.');
      pass(p < 6, '少于 6 HCP，不应叫。', 'Fewer than 6 HCP; no response.'); return finish();
    }
    if (last.terminal) { pass(true); return finish(); }
    if (last.rule === 'simpleRaise' || last.rule === 'limitRaise') {
      const t = last.suit;
      if (['H', 'S'].includes(t)) add('4' + t, p >= (last.rule === 'limitRaise' ? 15 : 19) && p <= 21, 'majorGame', '按已知配合与搭档点力下限，选择高花成局。', 'Choose major game based on the fit and partner’s shown minimum.', { terminal: true, suit: t });
      pass(p < (last.rule === 'limitRaise' ? 15 : 17), '本手不接受邀局或不再尝试成局。', 'Decline the invitation or make no further game try.'); return finish();
    }
    if (last.rule === 'newSuit') {
      const t = last.suit;
      if (['H', 'S'].includes(t)) add('2' + t, l[t] >= 4 && p <= 15, 'rebidRaise', '12–15 HCP，四张支持搭档高花。', '12–15 HCP and four-card support for partner’s major.', { suit: t, min: 12, max: 15 });
      const unshownMajor = ['H', 'S'].some(m => m !== t && l[m] >= 4 && legal.includes('1' + m));
      add('1NT', balanced && p >= 12 && p <= 14 && !unshownMajor && (!['H', 'S'].includes(t) || l[t] < 4), 'rebidNT', '12–14 HCP，均型，无四张支持搭档高花，也没有可在一阶显示的另一门四张高花。', '12–14 HCP, balanced, without four-card support or an available one-level four-card major rebid.', { min: 12, max: 14 });
      add('2' + s, p <= 15 && l[s] >= 6, 'rebidLong', '12–15 HCP，六张以上开叫花色，非逼叫。', '12–15 HCP and 6+ cards in the opening suit; nonforcing.', { suit: s, min: 12, max: 15 }); return finish();
    }
    if (last.rule === 'suitNT') {
      add('2' + s, l[s] >= 6 && p <= 15, 'signoff', '六张以上开叫花色，最低限止叫。', '6+ cards in the opening suit; minimum signoff.', { terminal: true, suit: s });
      pass(p <= 15, '最低限，接受搭档的非逼叫 1NT。', 'Minimum; accept partner’s nonforcing 1NT.'); return finish();
    }
    if (last.rule === 'rebidNT') {
      add('3NT', p >= 13 && p <= 18 && balanced, 'ntGame', '均型，结合搭档 12–14 HCP 选择无将成局。', 'Balanced; choose notrump game opposite partner’s 12–14 HCP.', { terminal: true });
      add('2NT', p >= 11 && p <= 12 && balanced, 'naturalInvite', '11–12 HCP，均型，邀请 3NT。', '11–12 HCP, balanced; invite 3NT.');
      pass(p <= 10, '不足邀局实力，接受 1NT。', 'Below invitational strength; accept 1NT.'); return finish();
    }
    if (last.rule === 'naturalInvite') { add('3NT', p === 14, 'ntGame', '最高限，接受邀局。', 'Maximum; accept the invitation.', { terminal: true }); pass(p < 14); return finish(); }
    if (last.rule === 'rebidRaise') {
      add('4' + last.suit, p >= 13 && p <= 18, 'majorGame', '已确认高花配合，具有成局实力。', 'A confirmed major fit with game values.', { terminal: true, suit: last.suit });
      pass(p <= 9, '接受最低限高花部分定约。', 'Accept the minimum major partscore.'); return finish();
    }
    if (last.rule === 'rebidLong') { pass(p <= 10, '接受搭档的长套部分定约。', 'Accept partner’s long-suit partscore.'); return finish(); }
  }
  return [];
}

export function decide(context) {
  const options = choices(context);
  return { options, recommended: options.find(c => c.fits) || null };
}
export function evaluate(context, call) {
  const { options, recommended } = decide(context);
  const chosen = options.find(c => c.call === call);
  const stats = analyze(context.hand);
  return {
    seat: context.seat, call,
    ...(chosen || { rule: 'uncovered', meaning: bi('当前体系尚未定义这一进程中的该叫品。', 'This call in this auction is not defined by the current system.') }),
    feedback: !chosen ? 'uncovered' : !chosen.fits ? 'mismatch' : recommended?.call === call ? 'match' : 'alternative',
    expected: recommended?.call || null,
    reason: bi(`本手 ${stats.hcp} HCP；♠♥♣♦ 张数 ${SUITS.map(s => stats.lengths[s]).join('–')}。${chosen?.fits ? '满足上述条件。' : chosen ? '不满足上述条件，请对照点力与牌型。' : '此处无法可靠评价。'}`, `This hand has ${stats.hcp} HCP; ♠♥♣♦ lengths ${SUITS.map(s => stats.lengths[s]).join('–')}. ${chosen?.fits ? 'It meets the conditions above.' : chosen ? 'It does not meet the conditions above; compare strength and shape.' : 'A reliable assessment is unavailable here.'}`)
  };
}

export function describeGap(context) {
  const actions = context.history.filter(e => e.call !== 'P');
  const p = analyze(context.hand).hcp;
  if (!actions.length && p >= 22) return bi('本手达到强开叫范围，强 2♣ 及其后续尚未实现。', 'This hand reaches the strong-opening range. Strong 2♣ and its continuations are not implemented.');
  if (actions.some(e => ['X', 'XX'].includes(e.call))) return bi('加倍／再加倍合法性已支持，但这段叫牌的含义与后续尚未定义。', 'Double/redouble legality is supported, but the meanings and continuations here are not defined.');
  if (actions.length && !actions.some(e => sameSide(e.seat, context.seat))) return bi('本手需要当前教学防守策略之外的决定；该争叫或技术性加倍进程尚未覆盖。', 'This hand needs a decision beyond the teaching defensive policy; the overcall or takeout-double sequence is not covered.');
  if (actions.some(e => sameSide(e.seat, context.seat)) && actions.some(e => !sameSide(e.seat, context.seat))) return bi('这一竞争性叫牌进程的继续叫牌尚未定义。', 'Further bidding in this competitive auction is not defined.');
  if (actions[0]?.rule === 'openNT' && p >= 33 - context.system.ntMax && context.seat !== actions[0].seat) return bi('本手需要考虑满贯；问叫与满贯探索尚未实现。', 'This hand needs slam consideration; asking bids and slam exploration are not implemented.');
  if (actions.at(-1)?.rule === 'transferAccept') return bi('转移后的双高花或其他复杂牌型，需要尚未实现的新花色后续。', 'Two-major or other complex shapes after a transfer require a new-suit continuation that is not implemented.');
  return bi('当前手牌与叫牌进程需要尚未实现的应叫或再叫规则。', 'This hand and auction require a response or rebid rule that is not implemented yet.');
}

export async function generateHands(theme, system, rng = Math.random) {
  for (let n = 0; n < 100000; n++) {
    if (n && n % 500 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    const hands = deal(rng);
    if (theme === 'free') return hands;
    const s = analyze(hands.S);
    if (theme === 'opening' && s.hcp >= 8 && s.hcp <= 21) return hands;
    const north = analyze(hands.N);
    if (!north.balanced || north.hcp < system.ntMin || north.hcp > system.ntMax || (!system.allowFiveMajor && (north.lengths.H >= 5 || north.lengths.S >= 5))) continue;
    if (analyze(hands.E).hcp >= 10 || analyze(hands.W).hcp >= 10 || s.hcp >= 33 - system.ntMax) continue;
    if (theme === 'nt' && s.balanced && s.lengths.H < 4 && s.lengths.S < 4) return hands;
    if (theme === 'stayman' && s.hcp >= 25 - system.ntMax && Math.max(s.lengths.H, s.lengths.S) === 4) return hands;
    if (theme === 'transfers' && Math.max(s.lengths.H, s.lengths.S) >= 5 && Math.min(s.lengths.H, s.lengths.S) < 4) return hands;
  }
  throw new Error('generation');
}
