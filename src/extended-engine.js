import { analyze, legalCalls, partner, sameSide, SUITS, SYMBOLS } from './cards.js';
import { bilingual as bi, systemBase } from './systems.js';

// Additional system-specific auctions. null delegates to the original natural
// engine; [] deliberately marks an uncovered continuation, never a forced Pass.
export function extendedChoices({ hand, seat, history, system }) {
  const { hcp: p, lengths: l, balanced } = analyze(hand);
  const base = systemBase(system), legal = legalCalls(history, seat), out = [];
  const add = (call, fits, rule, zh, en, meta = {}) => out.push({ call, fits, rule, meaning: bi(zh, en), ...meta });
  const pass = (fits = true) => add('P', fits, 'pass', '接受当前非逼叫定约。', 'Accept the current nonforcing contract.');
  const done = () => out.filter(c => legal.includes(c.call));
  const actions = history.filter(e => e.call !== 'P');
  const opening = actions[0];
  const ours = actions.filter(e => sameSide(e.seat, seat));
  const last = ours.at(-1);
  const longest = ['S', 'H', 'D', 'C'].sort((a, b) => l[b] - l[a]);
  const has = id => system.conventions.includes(id);
  const end = (call, fits, zh, en, meta = {}) => add(call, fits, 'systemSignoff', zh, en, { terminal: true, ...meta });
  const majorGame = (s, fits) => end('4' + s, fits, `已确认${SYMBOLS[s]}配合，选择高花成局。`, `With a confirmed ${SYMBOLS[s]} fit, choose game.`, { suit: s });

  if (!opening && base === 'precision') {
    add('2NT', balanced && p >= 22 && p <= 24, 'openNT2', '精确：22–24 HCP，均型。', 'Precision: 22–24 HCP, balanced.', { min: 22, max: 24 });
    add('1C', p >= 16, 'precisionClub', '精确强梅花：16+ HCP，人工开叫，逼叫一轮；22–24 均型优先 2NT。', 'Precision strong club: artificial 16+ HCP, forcing one round; prefer 2NT with 22–24 balanced.', { min: 16, forcing: true, alert: true });
    add('1NT', p >= system.ntMin && p <= system.ntMax && balanced && (system.allowFiveMajor || Math.max(l.S, l.H) < 5), 'openNT', `精确：${system.ntMin}–${system.ntMax} HCP，均型。`, `Precision: ${system.ntMin}–${system.ntMax} HCP, balanced.`, { min: system.ntMin, max: system.ntMax });
    for (const s of ['S', 'H']) add('1' + s, p >= 11 && p <= 15 && l[s] >= 5 && l[s] === Math.max(l.H, l.S) && !(s === 'H' && l.S === l.H), 'openSuit', `精确有限开叫：11–15 HCP，至少五张${SYMBOLS[s]}。`, `Precision limited opening: 11–15 HCP and 5+ ${SYMBOLS[s]}.`, { suit: s, min: 11, max: 15 });
    const shortD = l.S === 4 && l.H === 4 && l.D <= 1 && l.C === 5 - l.D;
    const clubs = l.C >= 6 || (l.C === 5 && Math.max(l.H, l.S) === 4);
    add('2D', p >= 11 && p <= 15 && shortD, 'precisionShortD', '本精确变体：11–15 HCP，♠♥♦♣ 为 4414 或 4405；人工短方块，非弱二。', 'This Precision variant: 11–15 HCP, 4414 or 4405 in ♠♥♦♣; artificial short diamonds, not a weak two.', { alert: true, min: 11, max: 15 });
    add('2C', p >= 11 && p <= 15 && clubs && !shortD && Math.max(l.S, l.H) < 5, 'precisionClubs', '精确：11–15 HCP，六张以上梅花，或五张梅花带四张高花。', 'Precision: 11–15 HCP, 6+ clubs or five clubs and a four-card major.', { suit: 'C', min: 11, max: 15 });
    add('1D', p >= 11 && p <= 15 && l.D >= 2 && Math.max(l.S, l.H) < 5 && !clubs && !shortD, 'openSuit', '精确有限方块：11–15 HCP，至少两张方块，无五张高花、不符合 2♣/2♦；并不保证长方块。', 'Precision limited diamond: 11–15 HCP, 2+ diamonds, no five-card major or 2♣/2♦ shape; diamonds need not be long.', { suit: 'D', min: 11, max: 15 });
    if (has('weakTwo')) for (const s of ['S', 'H']) add('2' + s, p >= 6 && p <= 10 && l[s] === 6 && hand.filter(c => c[0] === s && 'AKQ'.includes(c[1])).length >= 2, 'weakTwo', `精确弱二：6–10 HCP，六张${SYMBOLS[s]}且至少两张 A/K/Q。`, `Precision weak two: 6–10 HCP, six ${SYMBOLS[s]} with two of A/K/Q.`, { suit: s, min: 6, max: 10 });
    pass(p < 11); return done();
  }
  if (!opening || !sameSide(opening.seat, seat)) return null;
  const specific = ['precisionClub', 'precisionClubs', 'precisionShortD', 'strong2c', 'openNT2', 'openNT3'].includes(opening.rule);
  const jacoby = ours.some(e => e.rule === 'jacobyRaise');
  if (!specific && !jacoby) return null;
  if (actions.some(e => !sameSide(e.seat, seat))) return [];
  if (last?.seat === seat) { if (last.forcing) return []; pass(); return done(); }
  if (last?.terminal) {
    if (jacoby && seat === opening.seat && p >= 18) return [];
    if (opening.rule === 'strong2c' && seat !== opening.seat && p >= 10 && ours.some(e => ['strongPositive', 'strongPositiveNT'].includes(e.rule))) return [];
    pass(); return done();
  }

  // Natural notrump openings / rebids at either the one or two level.
  const anchor = ours.findLast(e => ['openNT2', 'precisionNT', 'strongNT'].includes(e.rule));
  if (anchor) {
    const trail = ours.slice(ours.indexOf(anchor)), level = Number(anchor.call[0]) + 1;
    const game = 25 - anchor.min, invite = 25 - anchor.max, slam = 33 - anchor.max;
    if (trail.length === 1) {
      if (has('transfers')) for (const s of ['S', 'H']) add(level + (s === 'S' ? 'H' : 'D'), l[s] >= 5 && l[s] === Math.max(l.S, l.H) && p < slam, 'extendedTransfer', `至少五张${SYMBOLS[s]}，转移叫，要求接受转移。`, `5+ ${SYMBOLS[s]}; a transfer asking opener to accept.`, { suit: s, alert: true, forcing: true });
      if (has('stayman')) add(level + 'C', p >= (level === 2 ? invite : game) && p < slam && Math.max(l.H, l.S) >= 4, 'extendedStayman', '斯台曼（Stayman）：询问四张高花，具有继续叫牌所需的实力。', 'Stayman: asks for a four-card major with values to continue.', { alert: true, forcing: true });
      end('3NT', p >= game && p < slam && Math.max(l.H, l.S) < 5, '结合搭档已显示的点力范围，选择无将成局。', 'Choose notrump game using partner’s shown strength range.');
      if (level === 2) add('2NT', p >= invite && p < game && Math.max(l.H, l.S) < 5, 'extendedInvite', `${invite}–${game - 1} HCP，邀请成局。`, `${invite}–${game - 1} HCP, inviting game.`, { inviteMin: invite });
      pass(p < (level === 2 ? invite : game)); return done();
    }
    if (last.rule === 'extendedTransfer') { add(level + last.suit, true, 'extendedAccept', '按约定接受转移，不额外承诺长度。', 'Accept the transfer without promising extra length.', { suit: last.suit }); return done(); }
    if (last.rule === 'extendedStayman') {
      for (const s of ['H', 'S', 'D']) add(level + s, s === 'H' ? l.H >= 4 : s === 'S' ? l.H < 4 && l.S >= 4 : l.H < 4 && l.S < 4, 'extendedStaymanReply', s === 'D' ? '人工答叫，否认四张高花。' : `至少四张${SYMBOLS[s]}；双高花先答红心。`, s === 'D' ? 'Artificial reply, denying a four-card major.' : `4+ ${SYMBOLS[s]}; show hearts first with both majors.`, { suit: s, alert: s === 'D' }); return done();
    }
    if (last.rule === 'extendedAccept') {
      const s = last.suit;
      if (l[s === 'S' ? 'H' : 'S'] >= 4) return [];
      pass(p < (level === 2 ? invite : game));
      majorGame(s, p >= game && p < slam && l[s] >= 6);
      add('3NT', p >= game && p < slam && l[s] === 5, 'extendedChoice', '恰好五张高花，请搭档在 3NT 与高花成局间选择。', 'Exactly five cards in the major; partner chooses 3NT or major game.', { suit: s });
      if (level === 2) {
        add('2NT', p >= invite && p < game && l[s] === 5, 'extendedInvite', '五张高花，邀局；搭档决定花色与阶数。', 'Five-card major and an invitation; partner chooses strain and level.', { suit: s, inviteMin: invite, support: 3 });
        add('3' + s, p >= invite && p < game && l[s] >= 6, 'extendedInvite', '六张以上高花，邀请高花成局。', '6+ cards in the major; invite game.', { suit: s, inviteMin: invite, support: 2, suitOnly: true });
      }
      return done();
    }
    if (last.rule === 'extendedStaymanReply') {
      const s = last.suit, fit = s !== 'D' && l[s] >= 4;
      if (s !== 'D') majorGame(s, fit && p >= game && p < slam);
      add('3NT', !fit && p >= game && p < slam && Math.max(l.S, l.H) < 5, 'extendedChoice', '没有已显示高花配合，选择无将；保留另一高花配合的可能。', 'No fit for the shown major; choose notrump while allowing a fit in the other major.', { suit: s === 'H' ? 'S' : null, support: 4 });
      if (level === 2) {
        if (s !== 'D') add('3' + s, fit && p >= invite && p < game, 'extendedInvite', '已确认高花配合，邀局。', 'Invite game with a confirmed major fit.', { suit: s, support: 4, suitOnly: true, inviteMin: invite });
        add('2NT', !fit && p >= invite && p < game, 'extendedInvite', '无将邀局，保留另一高花配合的可能。', 'Invite in notrump, allowing a fit in the other major.', { suit: s === 'H' ? 'S' : null, support: 4, inviteMin: invite });
      }
      return done();
    }
    if (last.rule === 'extendedChoice') { if (last.suit) majorGame(last.suit, l[last.suit] >= (last.support || 3)); pass(!last.suit || l[last.suit] < (last.support || 3)); return done(); }
    if (last.rule === 'extendedInvite') {
      const accept = p + last.inviteMin >= 25, fit = last.suit && l[last.suit] >= (last.support || 3);
      if (last.suit) { majorGame(last.suit, accept && fit); if (!last.suitOnly) end('3' + last.suit, !accept && fit, '最低限，选择高花部分定约。', 'Minimum; choose a major partscore.'); }
      if (!last.suitOnly) end('3NT', accept && !fit, '接受无将邀局。', 'Accept the notrump invitation.');
      pass(!accept && (!fit || last.suitOnly)); return done();
    }
    return [];
  }
  if (opening.rule === 'openNT3') { pass(p <= 5); return done(); }

  if (jacoby) {
    const raise = ours.find(e => e.rule === 'jacobyRaise'), s = raise.suit;
    if (last.rule === 'jacobyRaise') {
      for (const side of ['C', 'D', 'H', 'S'].filter(t => t !== s)) add('3' + side, l[side] <= 1, 'jacobyReply', `单缺${SYMBOLS[side]}，保持逼局。`, `Singleton or void in ${SYMBOLS[side]}, game forcing.`, { shortness: side, suit: s, forcing: true, min: opening.min });
      const noShort = SUITS.every(t => t === s || l[t] >= 2);
      for (const side of SUITS.filter(t => t !== s)) add('4' + side, noShort && l[side] >= 5 && hand.filter(c => c[0] === side && 'AKQ'.includes(c[1])).length >= 2, 'jacobyReply', `良好五张以上${SYMBOLS[side]}边套，逼局。`, `A good 5+ card ${SYMBOLS[side]} side suit, game forcing.`, { suit: s, forcing: true, min: opening.min });
      add('3' + s, noShort && p >= 18, 'jacobyReply', '18+ HCP，无单缺，强牌保持低阶以探索满贯。', '18+ HCP without shortness; preserve space for slam exploration.', { suit: s, forcing: true, min: 18 });
      add('3NT', noShort && p >= 15 && p <= 17, 'jacobyReply', '15–17 HCP，无单缺，逼局。', '15–17 HCP without shortness, game forcing.', { suit: s, forcing: true, min: 15 });
      add('4' + s, noShort && p <= 14, 'jacobyMinimum', '最低限（12–14 HCP），无单缺，快到成局。', 'Minimum (12–14 HCP), no shortness; fast arrival at game.', { suit: s }); return done();
    }
    if (last.rule === 'jacobyMinimum') { pass(p <= 15); return done(); }
    if (last.rule === 'jacobyReply') { majorGame(s, p >= 13 && p <= 15 && last.min < 18); return done(); }
    return [];
  }

  if (opening.rule === 'precisionClub') {
    if (ours.length === 1) {
      add('1D', p <= 7, 'precisionNegative', '精确否定答叫：0–7 HCP，人工，不承诺方块。', 'Precision negative: 0–7 HCP, artificial; no diamonds promised.', { alert: true });
      for (const s of longest) add((['H', 'S'].includes(s) ? '1' : '2') + s, p >= 8 && l[s] >= 5, 'precisionPositive', `积极答叫：8+ HCP，五张以上${SYMBOLS[s]}，逼局。本版采用自然后续，不使用支持问叫。`, `Positive: 8+ HCP, 5+ ${SYMBOLS[s]}, game forcing. This baseline uses natural continuations, not support-asking bids.`, { suit: s, forcing: true });
      add('1NT', p >= 8 && p <= 13 && balanced && Math.max(l.S, l.H) < 5, 'precisionPositiveNT', '积极无将：8–13 HCP，均型，无五张高花，逼局。', 'Positive notrump: 8–13 HCP, balanced, no five-card major, game forcing.', { forcing: true });
      add('2NT', p >= 14 && balanced && Math.max(l.S, l.H) < 5, 'precisionPositiveStrongNT', '14+ HCP，均型，逼局并有满贯潜力；后续尚待定义。', '14+ HCP, balanced, game forcing with slam potential; continuations are not yet defined.', { forcing: true }); return done();
    }
    if (last.rule === 'precisionNegative') {
      add('1NT', balanced && p >= 16 && p <= 19, 'precisionNT', '16–19 HCP，均型，非逼叫。后续使用无将约定。', '16–19 HCP, balanced, nonforcing; notrump conventions apply.', { min: 16, max: 19 });
      for (const s of longest) add((['H', 'S'].includes(s) ? '1' : '2') + s, p >= 16 && p <= 21 && l[s] >= 5, 'precisionNatural', `16–21 HCP，五张以上${SYMBOLS[s]}，自然非逼叫。`, `16–21 HCP, 5+ ${SYMBOLS[s]}, natural and nonforcing.`, { suit: s, min: 16, max: 21 }); return done();
    }
    if (last.rule === 'precisionNatural') {
      const s = last.suit;
      add('2' + s, ['H', 'S'].includes(s) && p >= 5 && p <= 7 && l[s] >= 3, 'precisionNegativeRaise', '否定答叫的高限：5–7 HCP，至少三张高花支持。', 'Upper negative range: 5–7 HCP with 3+ card major support.', { suit: s });
      add('1NT', p >= 5 && p <= 7 && balanced && l[s] < 3, 'precisionNegativeNT', '5–7 HCP，均型，没有三张支持，非逼叫无将应叫。', '5–7 HCP, balanced, without three-card support; nonforcing notrump.');
      pass(p <= 4 && l[s] >= 2); return done();
    }
    if (last.rule === 'precisionNegativeRaise') {
      majorGame(last.suit, p >= 20 && p <= 21);
      add('3' + last.suit, p >= 18 && p <= 19, 'precisionNegativeInvite', '18–19 HCP，邀请高花成局。', '18–19 HCP; invite major game.', { suit: last.suit });
      pass(p <= 17); return done();
    }
    if (last.rule === 'precisionNegativeNT') {
      end('3NT', p >= 20 && p <= 21 && balanced, '20–21 HCP，结合搭档 5–7 点选择无将成局。', '20–21 HCP opposite 5–7; choose notrump game.');
      add('2NT', p >= 18 && p <= 19, 'precisionNegativeInvite', '18–19 HCP，邀请无将成局。', '18–19 HCP; invite notrump game.');
      pass(p <= 17); return done();
    }
    if (last.rule === 'precisionNegativeInvite') { if (last.suit) majorGame(last.suit, p === 7); else end('3NT', p === 7, '否定答叫最高限，接受邀局。', 'Maximum negative response; accept the invitation.'); pass(p < 7); return done(); }
    if (last.rule === 'precisionPositive') {
      const s = last.suit;
      if (['H', 'S'].includes(s)) add('2' + s, p <= 18 && l[s] >= 3, 'precisionFit', '16–18 HCP，三张以上支持，保持逼局。', '16–18 HCP and 3+ card support, game forcing.', { suit: s, forcing: true });
      add('2NT', p <= 18 && balanced && (!['H', 'S'].includes(s) || l[s] < 3), 'precisionForceNT', '16–18 HCP，均型；若搭档显示高花则无三张支持，保持逼局。', '16–18 HCP, balanced; no three-card support for a shown major, game forcing.', { forcing: true }); return done();
    }
    if (last.rule === 'precisionPositiveNT') { end('3NT', p <= 18 && balanced, '强梅花与积极均型答叫后选择无将成局。', 'Choose notrump game after the strong club and positive balanced response.'); return done(); }
    if (last.rule === 'precisionFit') { majorGame(last.suit, p >= 8 && p <= 13); return done(); }
    if (last.rule === 'precisionForceNT') { end('3NT', p >= 8 && p <= 13 && balanced, '均型积极应叫手，选择无将成局。', 'Balanced positive responder; choose notrump game.'); return done(); }
    return [];
  }

  if (opening.rule === 'strong2c') {
    if (ours.length === 1) {
      const good = s => l[s] >= 5 && hand.filter(c => c[0] === s && 'AKQ'.includes(c[1])).length >= 2;
      for (const s of longest) add((['H', 'S'].includes(s) ? '2' : '3') + s, p >= 8 && good(s), 'strongPositive', `8+ HCP，良好五张以上${SYMBOLS[s]}，积极答叫、逼局。`, `8+ HCP, a good 5+ card ${SYMBOLS[s]} suit; positive and game forcing.`, { suit: s, forcing: true });
      add('2NT', p >= 8 && balanced && !SUITS.some(good), 'strongPositiveNT', '8+ HCP，均型，无适合积极显示的好套，逼局。', '8+ HCP, balanced, no suitable positive suit; game forcing.', { forcing: true });
      add('2D', p < 8 || (!balanced && !SUITS.some(good)), 'strongWaiting', '人工等待答叫，不承诺方块，不单独限定点力。', 'Artificial waiting response; no diamonds promised and no standalone strength limit.', { alert: true, forcing: true }); return done();
    }
    if (last.rule === 'strongWaiting') {
      add('2NT', balanced && p >= 22 && p <= 24, 'strongNT', '22–24 HCP，均型；此再叫非逼叫。', '22–24 HCP, balanced; this rebid is nonforcing.', { min: 22, max: 24 });
      for (const s of longest) add((['H', 'S'].includes(s) ? '2' : '3') + s, !balanced && l[s] >= 5, 'strongNatural', `强牌自然再叫，五张以上${SYMBOLS[s]}；逼叫，低点力二次否定后续暂未实现。`, `Strong natural rebid with 5+ ${SYMBOLS[s]}; forcing. Second-negative continuations are not implemented.`, { suit: s, forcing: true }); return done();
    }
    if (last.rule === 'strongNatural') {
      if (['H', 'S'].includes(last.suit)) majorGame(last.suit, p >= 4 && p <= 7 && l[last.suit] >= 3);
      end('3NT', p >= 4 && p <= 7 && balanced && l[last.suit] < 3, '4–7 HCP、均型，无高花配合，选择无将成局。', '4–7 HCP, balanced, no major fit; choose notrump game.'); return done();
    }
    if (last.rule === 'strongPositive') { if (['H', 'S'].includes(last.suit)) majorGame(last.suit, p <= 23 && l[last.suit] >= 3); return done(); }
    if (last.rule === 'strongPositiveNT') { end('3NT', p <= 23 && balanced, '最低限强开叫，均型，选择无将成局。', 'Minimum strong opening, balanced; choose notrump game.'); return done(); }
    return [];
  }

  if (opening.rule === 'precisionClubs') {
    if (ours.length === 1) {
      add('2D', p >= 11, 'precisionClubAsk', '11+ HCP，人工询问高花与牌型，逼叫一轮。', '11+ HCP, artificial inquiry about majors and shape, forcing one round.', { alert: true, forcing: true });
      for (const s of ['H', 'S']) end('2' + s, p >= 8 && p <= 10 && l[s] >= 5, '8–10 HCP，五张以上高花，自然非逼叫。', '8–10 HCP, a five-card major, natural and nonforcing.', { suit: s });
      end('3C', p >= 8 && p <= 10 && l.C >= 3, '8–10 HCP，至少三张梅花支持，部分定约。', '8–10 HCP, 3+ club support; a partscore.');
      pass(p < 8 && l.C >= 2); return done();
    }
    if (last.rule === 'precisionClubAsk') {
      for (const s of ['H', 'S']) add('2' + s, l[s] >= 4 && !(s === 'S' && l.H >= 4), 'precisionClubReply', `显示四张${SYMBOLS[s]}。`, `Shows four ${SYMBOLS[s]}.`, { suit: s, min: 11, max: 15 });
      add('2NT', Math.max(l.S, l.H) < 4 && p >= 14 && Math.min(...Object.values(l)) >= 2, 'precisionClubReply', '14–15 HCP，无四张高花，无单缺，六张梅花。', '14–15 HCP, no four-card major or shortness, six clubs.', { suit: 'NT', min: 14, max: 15 });
      add('3C', Math.max(l.S, l.H) < 4 && !(p >= 14 && Math.min(...Object.values(l)) >= 2), 'precisionClubReply', '无四张高花，不适合高限 2NT 再叫，六张以上梅花。', 'No four-card major, unsuitable for the maximum 2NT rebid, 6+ clubs.', { suit: 'C', min: 11, max: 15 }); return done();
    }
    if (last.rule === 'precisionClubReply') {
      if (['H', 'S'].includes(last.suit)) majorGame(last.suit, l[last.suit] >= 4 && p + last.min >= 25 && p + last.max < 33);
      end('3NT', balanced && p + last.min >= 25 && p + last.max < 33 && (!['H', 'S'].includes(last.suit) || l[last.suit] < 4), '结合已显示范围与均型，选择无将成局。', 'Choose notrump game from the shown range and balanced shape.');
      pass(p <= 13 && (last.suit === 'C' ? l.C >= 3 : last.suit === 'NT' ? balanced : l[last.suit] >= 4)); return done();
    }
    return [];
  }
  if (opening.rule === 'precisionShortD') {
    if (ours.length === 1) {
      add('2NT', p >= 11, 'precisionShapeAsk', '11+ HCP，询问具体牌型与范围，逼叫一轮。', '11+ HCP; ask for exact shape and range, forcing one round.', { alert: true, forcing: true });
      for (const s of ['H', 'S']) end('2' + s, p <= 10 && l[s] >= 4 && l[s] === Math.max(l.H, l.S), '四张以上高花，弱牌选择已知的高花配合。', '4+ cards in a major; a weak hand chooses the known major fit.', { suit: s });
      end('3C', p <= 10 && l.C >= 4, '弱牌，四张以上梅花，选择梅花配合。', 'Weak, 4+ clubs; choose the club fit.'); return done();
    }
    if (last.rule === 'precisionShapeAsk') {
      const high = p >= 14, call = l.D === 0 ? (high ? '4D' : '4C') : (high ? '3S' : '3H');
      add(call, true, 'precisionShapeReply', `${high ? '14–15' : '11–13'} HCP，♠♥♦♣ 为 ${l.D === 0 ? '4405' : '4414'}；人工答叫。`, `${high ? '14–15' : '11–13'} HCP, ${l.D === 0 ? '4405' : '4414'} in ♠♥♦♣; artificial reply.`, { alert: true, min: high ? 14 : 11, max: high ? 15 : 13 }); return done();
    }
    if (last.rule === 'precisionShapeReply') { for (const s of ['H', 'S']) majorGame(s, l[s] >= 4 && p + last.min >= 25 && p + last.max < 33); return done(); }
    return [];
  }
  return [];
}
