import { SEATS, SUITS, STRAINS, SYMBOLS, RANKS, analyze, sortHand, nextSeat, callText, auctionEnded, legalCalls, contract, sameSide } from './cards.js';
import { decide, evaluate, generateHands, describeGap } from './engine.js';
import { DEFAULT_SYSTEM, CONVENTIONS, SYSTEM_LIBRARY, validateSystem } from './systems.js';
import { clone, uid, load, persist, validatePayload, encodeBoard, decodeBoard } from './storage.js';
import { translate } from './i18n.js';

const loaded = load();
let state = loaded.state;
let page = 'home', modal = null, selectedCall = '', selectedEntry = -1, hint = null, revealedReason = false, timer = null, busy = false;
let draft = clone(state.systems[0]), draftDirty = false, libraryQuery = '', libraryGroup = 'all', recordFilter = 'all';
let setup = { theme: 'nt', dealer: 'random', vulnerability: 'random', visibility: 'solo' };
let saveOK = !loaded.error;
const root = document.querySelector('#app');
const t = key => translate(key, state.language);
const tx = value => typeof value === 'string' ? value : value?.[state.language] || '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = { home: '◈', table: '♠', system: '☷', library: '▤', records: '◷' };
const button = (action, text, css = 'btn', attrs = '') => `<button class="${css}" data-action="${action}" ${attrs}>${text}</button>`;
const check = (key, label, checked, attrs = '') => `<label class="check"><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''} ${attrs}><span>${label}</span></label>`;
const select = (name, options, value, attrs = '') => `<select name="${name}" ${attrs}>${options.map(([v, label]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
const selectedSystem = side => state.systems.find(s => s.id === state[side]) || state.systems[0];
const seatToPlay = b => b.history.length ? nextSeat(b.history.at(-1).seat) : b.dealer;
const context = b => { const seat = seatToPlay(b); return { hand: b.hands[seat], seat, history: b.history, system: b.systems[['N', 'S'].includes(seat) ? 'NS' : 'EW'] }; };
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('visible'), 4500); }
function save() {
  saveOK = persist(state);
  const status = document.querySelector('.save-status');
  if (status) { status.classList.toggle('error', !saveOK); status.innerHTML = `<i></i>${t(saveOK ? 'local' : 'saveFailed')}`; }
}
function archive() {
  if (!state.current) return;
  const b = state.current;
  if (b.status !== 'active') {
    const index = state.records.findIndex(r => r.id === b.id);
    if (index >= 0) state.records[index] = clone(b); else state.records.unshift(clone(b));
    state.records = state.records.slice(0, 500);
  }
  save();
}
function resetUI() { selectedCall = ''; selectedEntry = -1; hint = null; revealedReason = false; }
function render() {
  clearTimeout(timer);
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.title = `${t(page)} · ${t('brand')}`;
  root.innerHTML = `<div class="app-shell">
    <aside class="sidebar"><a class="brand" href="#" data-action="nav" data-page="home"><span class="brand-mark">♠</span><span><strong>${t('brand')}</strong><small>BRIDGE STUDIO</small></span></a>
      <div class="nav-caption">YOUR BIDDING SPACE</div><nav aria-label="${esc(t('brand'))}">${['home', 'table', 'system', 'library', 'records'].map(p => `<button data-action="nav" data-page="${p}" class="nav-item ${page === p ? 'active' : ''}" ${page === p ? 'aria-current="page"' : ''}><span class="nav-icon">${icons[p]}</span>${t(p)}${p === 'table' && state.current?.status === 'active' ? '<i class="live-dot"></i>' : ''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="suit-signature">♠ <i>♥</i> ♣ <i>♦</i></div><p>${t('tagline')}</p><span class="version">V0.1 · PERSONAL PRACTICE</span></div>
    </aside>
    <div class="workspace"><header class="topbar"><span class="breadcrumb">${t('brand')} <span>/</span> ${t(page)}</span><div class="top-actions"><span class="save-status ${saveOK ? '' : 'error'}"><i></i>${t(saveOK ? 'local' : 'saveFailed')}</span>${button('language', state.language === 'zh' ? 'EN / 中文' : 'EN / 中文', 'language-button', 'aria-label="Switch language / 切换语言"')}${button('settings', '⚙', 'icon-button', `aria-label="${t('settings')}"`)}</div></header>
    <main id="main-content">${page === 'home' ? homeView() : page === 'table' ? tableView() : page === 'system' ? systemView() : page === 'library' ? libraryView() : recordsView()}</main>
    <footer><span>${t('offline')}</span><span>♠ ♥ ♣ ♦ <span class="footer-brand">BRIDGE STUDIO</span></span></footer></div></div>${modalView()}`;
  schedule();
}
function title(kicker, titleText, subtitle, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${titleText}</h1><p>${subtitle}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`; }
function homeView() {
  const systemOptions = state.systems.map(s => [s.id, s.name]);
  return `${title('A LITTLE PRACTICE. A BETTER PARTNERSHIP.', t('welcome'), t('intro'))}
    <div class="home-grid"><section class="panel session-panel"><div class="section-title"><span class="step">01</span><h2>${t('session')}</h2><span class="subtle">SOUTH / 南</span></div>
    <div class="theme-grid">${['free', 'opening', 'nt', 'stayman', 'transfers'].map((theme, i) => `<button data-action="theme" data-theme="${theme}" class="theme-card ${setup.theme === theme ? 'selected' : ''}" aria-pressed="${setup.theme === theme}"><span class="theme-number">0${i + 1}</span><strong>${t(theme)}</strong><small>${t(theme + 'Desc')}</small><span class="theme-check">${setup.theme === theme ? '✓' : '↗'}</span></button>`).join('')}</div>
    <div class="form-grid"><label>${t('ourSystem')}${select('ns', systemOptions, state.ns)}</label><label>${t('theirSystem')}${select('ew', systemOptions, state.ew)}</label><label>${t('visibility')}${select('visibility', ['solo', 'partnership', 'all', 'custom'].map(v => [v, t(v)]), setup.visibility)}</label><label>${t('vulnerability')}${select('vulnerability', ['random', 'none', 'NS', 'EW', 'both'].map(v => [v, t(v)]), setup.vulnerability)}</label><label>${t('dealer')}${select('dealer', ['random', ...SEATS].map(v => [v, t(v)]), setup.dealer, setup.theme !== 'free' ? 'disabled' : '')}</label><div class="start-checks">${check('showHcp', t('hcp'), state.settings.showHcp)}${check('showShape', t('shape'), state.settings.showShape)}</div></div>
    ${setup.visibility === 'custom' ? `<div class="inline-controls">${['N', 'E', 'W'].map(s => check('visible-' + s, t(s), state.settings.visible[s])).join('')}</div>` : ''}
    <p class="form-note">${setup.theme !== 'free' ? t('themeDealer') : t('policyNote')}</p>
    <div class="session-bottom">${button('begin', busy ? t('generating') : t('begin') + ' <span>→</span>', 'btn primary wide', busy ? 'disabled' : '')}${state.current ? button('resume', t('resume'), 'text-button') : ''}</div></section>
    <aside class="home-aside"><div class="editorial-card"><span class="eyebrow">THE ART OF UNDERSTANDING</span><div class="decor-cards" aria-hidden="true"><div class="decor-card">A<span>♠</span></div><div class="decor-card red">K<span>♥</span></div></div><h2>${state.language === 'zh' ? '好的叫牌，<br>从听懂搭档开始。' : 'Good bidding starts<br>with listening.'}</h2><p>${state.language === 'zh' ? '不只知道叫什么。也知道这个叫品，向搭档说了什么。' : 'Learn what to bid, and what your bid says to the player across the table.'}</p><div class="editorial-line"></div><span class="eyebrow">PRACTICE · UNDERSTAND · REPEAT</span></div><div class="scope-card"><span class="scope-icon">↗</span><h3>${t('scope')} <span>V0.1</span></h3><p>${t('scopeText')}</p>${button('nav', t('system') + ' →', 'text-button', 'data-page="system"')}</div></aside></div>`;
}
function callHTML(call) { const red = /[HD]$/.test(call); return `<span class="call ${red ? 'red' : ''}">${esc(callText(call))}</span>`; }
function handView(b, seat) {
  const visible = seat === 'S' || b.status !== 'active' || state.settings.visible[seat];
  const stats = analyze(b.hands[seat]);
  const active = b.status === 'active' && seatToPlay(b) === seat;
  const vulnerable = b.vulnerability === 'both' || b.vulnerability === (['N', 'S'].includes(seat) ? 'NS' : 'EW');
  return `<section class="hand hand-${seat} ${active ? 'current-player' : ''} ${visible ? 'revealed' : ''}"><div class="hand-heading"><span class="seat-badge ${vulnerable ? 'vulnerable' : ''}">${seat}</span><strong>${t(seat)}</strong>${b.dealer === seat ? '<span class="dealer-chip" title="Dealer">D</span>' : ''}${seat !== 'S' && b.status === 'active' ? button('visibility', t(visible ? 'hide' : 'show'), 'hand-toggle', `data-seat="${seat}" aria-label="${t(visible ? 'hide' : 'show')} ${t(seat)}"`) : ''}</div>
    ${visible ? (seat === 'S' ? `<div class="playing-cards">${sortHand(b.hands[seat]).map(c => `<div class="playing-card ${'HD'.includes(c[0]) ? 'red' : ''}" aria-label="${c[1]}${SYMBOLS[c[0]]}"><span class="corner top">${c[1] === 'T' ? '10' : c[1]}<small>${SYMBOLS[c[0]]}</small></span><span class="card-symbol">${SYMBOLS[c[0]]}</span><span class="corner bottom">${c[1] === 'T' ? '10' : c[1]}<small>${SYMBOLS[c[0]]}</small></span></div>`).join('')}</div>` : `<div class="compact-hand">${SUITS.map(s => `<div class="suit-row ${'HD'.includes(s) ? 'red' : ''}"><span>${SYMBOLS[s]}</span><b>${[...RANKS].filter(r => b.hands[seat].includes(s + r)).map(r => r === 'T' ? '10' : r).join(' ') || '—'}</b></div>`).join('')}</div>`) : `<div class="card-backs" aria-hidden="true">${Array.from({ length: 5 }, () => '<i></i>').join('')}</div><span class="hidden-label">${t('handHidden')}</span>`}
    ${visible ? `<div class="hand-stats">${state.settings.showHcp ? `<span><b>${stats.hcp}</b> HCP</span>` : ''}${state.settings.showShape ? `<span>♠♥♣♦ ${SUITS.map(s => stats.lengths[s]).join('–')}</span>` : ''}${seat === 'S' && active ? `<span class="turn-label">● ${t('yourTurn')}</span>` : ''}</div>` : ''}</section>`;
}
function auctionView(b) {
  const cols = ['W', 'N', 'E', 'S'];
  const offset = cols.indexOf(b.dealer);
  const cells = Array(offset).fill(null).concat(b.history);
  const next = b.status === 'active' ? seatToPlay(b) : null;
  if (next) cells.push({ pending: true, seat: next });
  while (cells.length % 4) cells.push(null);
  return `<section class="panel auction-panel"><div class="section-title"><h2>${t('auction')}</h2><span class="eyebrow">AUCTION</span></div><table class="auction-table"><thead><tr>${cols.map(s => `<th class="${s === 'S' ? 'you' : ''}">${s}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: Math.max(1, cells.length / 4) }, (_, row) => `<tr>${cols.map((s, col) => { const i = row * 4 + col, e = cells[i]; return `<td>${e?.pending ? `<span class="pending-bid ${s === 'S' ? 'your-bid' : ''}">${s === 'S' ? '?' : '•••'}</span>` : e ? `<button class="auction-call ${(selectedEntry < 0 ? b.history.length - 1 : selectedEntry) === i - offset ? 'selected' : ''}" data-action="inspect" data-index="${i - offset}" aria-label="${s} ${callText(e.call)}">${callHTML(e.call)}${e.alert ? '<sup>*</sup>' : ''}</button>` : '<span class="empty-cell">—</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></section>`;
}
function insightView(b) {
  const entry = b.history[selectedEntry < 0 ? b.history.length - 1 : selectedEntry];
  const hidden = entry && ((entry.seat === 'N' && !state.settings.explainPartner) || (['E', 'W'].includes(entry.seat) && !state.settings.explainOpponents));
  const unlocked = b.status !== 'active' || revealedReason || entry?.seat === 'S';
  return `<section class="panel insight-panel"><div class="section-title"><h2>${t('insight')}</h2><span class="insight-symbol">✧</span></div><div class="explanation-toggles">${check('explainPartner', t('partnerExplanation'), state.settings.explainPartner)}${check('explainOpponents', t('opponentExplanation'), state.settings.explainOpponents)}</div>${hidden ? `<p class="muted">${t('explanationHidden')}</p>` : entry ? `<div class="insight-call"><span>${t(entry.seat)}</span>${callHTML(entry.call)}${entry.alert ? '<span class="badge">Alert *</span>' : ''}</div><div class="eyebrow">${t('publicMeaning')}</div><p>${esc(tx(entry.meaning))}</p><div class="reason-block"><span class="eyebrow">${t('handReason')}</span><p>${unlocked ? esc(tx(entry.reason)) : t('locked')}</p>${!unlocked ? button('revealReason', t('revealReason'), 'text-button') : ''}</div>` : `<div class="empty-insight"><span>“</span><p>${t('clickHistory')}</p></div>`}
    ${hint ? `<div class="hint-card"><span>${t('expected')}</span>${hint.call ? callHTML(hint.call) : ''}<p>${hint.meaning ? esc(tx(hint.meaning)) : t('coverageText')}</p></div>` : ''}</section>`;
}
function tableView() {
  const b = state.current;
  if (!b) return `${title('TAKE YOUR SEAT', t('table'), t('noTable'))}${button('nav', t('home') + ' →', 'btn primary', 'data-page="home"')}`;
  const finished = b.status !== 'active';
  const c = finished && b.status === 'complete' ? contract(b.history) : null;
  const turn = seatToPlay(b), canBid = !finished && turn === 'S';
  const legal = canBid ? legalCalls(b.history, 'S') : [];
  const statusText = finished ? t(b.status === 'complete' ? 'complete' : 'stopped') : turn === 'S' ? t('yourTurn') : t(turn) + ' · ' + t('thinking');
  return `<div class="table-heading"><div><div class="eyebrow">${t(b.theme)} <span class="dot-separator">/</span> ${t(b.assisted ? 'assisted' : 'unassisted')}</div><h1>${finished ? t('review') : t('table')}<span class="board-number">#${esc(b.id.slice(0, 6).toUpperCase())}</span></h1></div><div class="heading-actions">${button('replay', '↻ ' + t('replay'))}${button('new', t('newDeal') + ' +', 'btn primary', busy ? 'disabled' : '')}</div></div>
    <div class="board-meta"><span>${t('dealer')} <b>${b.dealer}</b></span><span>${t(b.vulnerability)}</span><span>NS <b>${esc(b.systems.NS.name)}</b></span><span>EW <b>${esc(b.systems.EW.name)}</b></span></div>
    ${b.status === 'stopped' && b.stopReason !== 'manual' ? `<div class="notice amber"><strong>${t('coverageTitle')}</strong><p>${b.stopReason === 'userCall' ? esc(tx(b.history.at(-1)?.meaning)) : `${t(seatToPlay(b))} · ${esc(tx(describeGap(context(b))))}`}</p><p>${t('coverageText')}</p></div>` : ''}
    <div class="table-layout"><div class="table-main"><div class="bridge-table">${handView(b, 'N')}${handView(b, 'W')}<div class="table-center"><div class="compass"><span>N</span><span>W</span><span class="compass-spade">♠</span><span>E</span><span>S</span></div><div class="table-status" aria-live="polite">${statusText}</div>${c ? `<div class="contract-result">${callHTML(c.call)}${c.doubled}<small>${t('declarer')} ${c.declarer}</small></div>` : b.status === 'complete' ? `<span>${t('passedOut')}</span>` : ''}</div>${handView(b, 'E')}${handView(b, 'S')}</div>
    <div class="table-controls">${check('showHcp', t('hcp'), state.settings.showHcp)}${check('showShape', t('shape'), state.settings.showShape)}<span class="control-spacer"></span>${button('undo', '↶ ' + t('undo'), 'text-button', b.history.some(e => e.seat === 'S') ? '' : 'disabled')}${!finished ? button('hint', '✧ ' + t('hint'), 'text-button', canBid ? '' : 'disabled') : ''}</div>
    ${!finished ? `<section class="panel bidding-panel"><div class="section-title"><h2>${t('biddingBox')}</h2><span>${t('selectCall')}</span></div><div class="bid-grid">${Array.from({ length: 7 }, (_, i) => STRAINS.map(s => { const call = (i + 1) + s; return button('choose', callHTML(call), 'bid-button ' + (selectedCall === call ? 'chosen' : ''), `data-call="${call}" aria-pressed="${selectedCall === call}" ${legal.includes(call) ? '' : 'disabled'}`); }).join('')).join('')}</div><div class="bid-bottom"><div class="special-bids">${['P', 'X', 'XX'].map(call => button('choose', callText(call), 'bid-button special ' + (selectedCall === call ? 'chosen' : ''), `data-call="${call}" aria-pressed="${selectedCall === call}" ${legal.includes(call) ? '' : 'disabled'}`)).join('')}</div>${button('submit', `${t('confirm')} ${selectedCall ? callHTML(selectedCall) : '→'}`, 'btn primary confirm-bid', selectedCall && canBid ? '' : 'disabled')}</div></section><div class="end-row">${button('stop', t('stop'), 'text-button')}</div>` : reviewView(b)}
    </div><aside class="table-aside">${auctionView(b)}${insightView(b)}</aside></div>`;
}
function reviewView(b) {
  const userCalls = b.history.map((e, index) => ({ ...e, index })).filter(e => e.seat === 'S');
  return `<section class="panel review-panel"><div class="section-title"><h2>${t('review')}</h2><span class="badge">${t(b.assisted ? 'assisted' : 'unassisted')}</span></div><p class="muted small">${t('policyNote')}</p><div class="review-calls">${userCalls.length ? userCalls.map(e => `<button class="review-call" data-action="inspect" data-index="${e.index}">${callHTML(e.call)}<span class="feedback ${e.feedback}">${t(e.feedback)}</span>${e.expected && e.expected !== e.call ? `<small>${t('expected')} ${callText(e.expected)}</small>` : ''}<span>↗</span></button>`).join('') : `<p class="muted">${t('noUserCalls')}</p>`}</div><label class="note-label">${t('note')}<textarea id="review-note" maxlength="1000" placeholder="${t('notePlaceholder')}">${esc(b.note)}</textarea></label><div class="review-actions">${button('favorite', (b.favorite ? '★ ' : '☆ ') + t('favorite'), 'btn ' + (b.favorite ? 'selected' : ''), `aria-pressed="${b.favorite}"`)}${button('mistake', (b.mistake ? '✓ ' : '+ ') + t('mistake'), 'btn ' + (b.mistake ? 'selected' : ''), `aria-pressed="${b.mistake}"`)}${button('share', '↗ ' + t('share'))}${button('exportDeal', '↓ ' + t('exportDeal'))}</div></section>`;
}
function systemView() {
  const errors = validateSystem(draft);
  return `${title('YOUR PARTNERSHIP AGREEMENTS', t('system'), t('systemIntro'), button('import', '↑ ' + t('import')) + button('exportSystem', '↓ ' + t('exportSystem')))}
    <div class="system-layout"><aside class="panel system-list">${state.systems.map(s => button('editSystem', `<strong>${esc(s.name)}</strong><span>v${s.version} · ${s.ntMin}–${s.ntMax} NT</span>`, `system-list-item ${draft.id === s.id ? 'active' : ''}`, `data-id="${esc(s.id)}"`)).join('')}${button('duplicate', '+ ' + t('duplicate'), 'text-button')}</aside>
    <section class="panel system-editor"><div class="section-title"><h2>${state.language === 'zh' ? '基础体系' : 'Base system'}</h2><span class="badge">5-CARD MAJORS</span></div><div class="form-grid"><label>${t('systemName')}<input id="system-name" maxlength="100" value="${esc(draft.name)}"></label><label>${t('ntRange')}${select('ntRange', [['15', '15–17 HCP'], ['12', '12–14 HCP']], String(draft.ntMin))}</label></div>${check('fiveMajor', t('fiveMajor'), draft.allowFiveMajor)}<div class="system-basics"><span>1♥ / 1♠ <b>5+</b></span><span>1♣ / 1♦ <b>3+</b></span><span>${state.language === 'zh' ? '常规开叫' : 'Opening'} <b>12–21 HCP</b></span></div>
    <div class="section-title convention-title"><h2>${t('conventions')}</h2><span>${state.language === 'zh' ? '可多选 · 自动检测冲突' : 'Multi-select · Conflict checks'}</span></div><div class="convention-options">${CONVENTIONS.filter(c => c.enabled).map(c => `<label class="convention-option ${draft.conventions.includes(c.id) ? 'enabled' : ''}"><input type="checkbox" data-convention="${c.id}" ${draft.conventions.includes(c.id) ? 'checked' : ''}><span><strong>${esc(tx(c.name))}</strong><small>${esc(tx(c.text))}</small></span><code>${c.sequence}</code></label>`).join('')}</div>
    ${errors.length ? `<div class="notice amber" role="alert"><strong>${t('conflict')}</strong>${errors.map(e => `<p>${esc(tx(e))}</p>`).join('')}</div>` : ''}
    <div class="editor-actions">${button('saveSystem', t('saveSystem'), 'btn primary', errors.length ? 'disabled' : '')}${button('reset', t('reset'), 'btn')}${button('deleteSystem', t('delete'), 'text-button danger', state.systems.length < 2 ? 'disabled' : '')}<span class="muted small">${draftDirty ? t('unsaved') : t('saved')}</span></div></section></div><div class="scope-inline"><strong>${t('scope')}</strong><p>${t('scopeText')}</p></div>`;
}
function libraryView() {
  const items = CONVENTIONS.filter(c => (libraryGroup === 'all' || c.group === libraryGroup) && `${c.name.zh} ${c.name.en}`.toLowerCase().includes(libraryQuery.toLowerCase()));
  return `${title('A SHARED LANGUAGE', t('library'), t('libraryIntro'))}<div class="library-toolbar"><input type="search" id="library-search" value="${esc(libraryQuery)}" placeholder="${t('search')}" aria-label="${t('search')}">${select('libraryGroup', [['all', t('allGroups')], ...['nt', 'opening', 'raise', 'competition', 'slam'].map(g => [g, t(g + 'Group')])], libraryGroup)}</div><div class="library-grid">${items.map(c => `<article class="panel library-card"><div class="library-card-top"><span class="badge ${c.enabled ? 'green' : ''}">${t(c.enabled ? 'supported' : 'reference')}</span><span class="subtle">${t(c.group + 'Group')}</span></div><h2>${esc(tx(c.name))}</h2><code>${c.sequence}</code><p>${esc(tx(c.text))}</p>${c.url ? `<a href="${c.url}" target="_blank" rel="noopener noreferrer">${t('readMore')}</a>` : ''}</article>`).join('') || `<p>${t('emptySearch')}</p>`}</div><section class="system-directory"><h2>${t('systemDirectory')}</h2><div class="directory-grid">${SYSTEM_LIBRARY.map(s => `<div><strong>${s.name}</strong><span>${tx(s.group)}</span><small class="${s.supported ? 'green-text' : ''}">${t(s.supported ? 'supported' : 'reference')}</small></div>`).join('')}</div></section><div class="reference-links"><strong>${t('source')}</strong><a href="https://www.bridgebum.com/bridge_bidding_conventions.php" target="_blank" rel="noopener noreferrer">Bridge Bum · Conventions ↗</a><a href="https://en.wikipedia.org/wiki/List_of_bidding_systems" target="_blank" rel="noopener noreferrer">Wikipedia · Bidding systems ↗</a><a href="https://web2.acbl.org/documentlibrary/play/SP3%20%28bk%29%20single%20pages.pdf" target="_blank" rel="noopener noreferrer">ACBL · SAYC booklet ↗</a></div>`;
}
function recordsView() {
  const records = state.records.filter(b => recordFilter === 'all' || (recordFilter === 'favorites' ? b.favorite : b.mistake));
  return `${title('SMALL DECISIONS. LASTING LESSONS.', t('records'), t('recordsIntro'), button('import', '↑ ' + t('import')) + button('backup', '↓ ' + t('backup')))}<div class="record-stats">${[['deals', state.records.length], ['favoritesCount', state.records.filter(b => b.favorite).length], ['mistakesCount', state.records.filter(b => b.mistake).length]].map(([label, n]) => `<div><strong>${n.toString().padStart(2, '0')}</strong><span>${t(label)}</span></div>`).join('')}</div><div class="filter-tabs">${['all', 'favorites', 'mistakes'].map(f => button('recordFilter', t(f === 'all' ? 'allRecords' : f), f === recordFilter ? 'active' : '', `data-filter="${f}"`)).join('')}</div><div class="record-list">${records.length ? records.map(b => { const c = b.status === 'complete' ? contract(b.history) : null; return `<article class="panel record-card"><div class="record-icon">${b.favorite ? '★' : '♠'}</div><div class="record-info"><h3>${t(b.theme)} <span>#${esc(b.id.slice(0, 6).toUpperCase())}</span></h3><p>${new Date(b.created).toLocaleString(state.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${t(b.assisted ? 'assisted' : 'unassisted')}</p></div><div class="record-contract">${c ? callHTML(c.call) + `<small>${c.declarer}${c.doubled}</small>` : t(b.status === 'complete' ? 'passedOut' : 'incomplete')}</div><div class="record-actions">${button('openRecord', t('openReview') + ' ↗', 'btn', `data-id="${esc(b.id)}"`)}${button('replayRecord', '↻', 'icon-button', `data-id="${esc(b.id)}" aria-label="${t('replay')}"`)}${button('deleteRecord', '×', 'icon-button', `data-id="${esc(b.id)}" aria-label="${t('delete')}"`)}</div></article>`; }).join('') : `<div class="empty-records"><span>♠</span><h2>${t('emptyRecords')}</h2>${button('nav', t('home') + ' →', 'btn primary', 'data-page="home"')}</div>`}</div>`;
}
function modalView() {
  if (!modal) return '';
  const content = modal.type === 'settings' ? `<h2 id="modal-title">${t('settings')}</h2><div class="settings-list">${check('showHcp', t('hcp'), state.settings.showHcp)}${check('showShape', t('shape'), state.settings.showShape)}${check('autoFeedback', t('feedback'), state.settings.autoFeedback)}<label>${t('speed')}${select('speed', [['0', t('instant')], ['700', t('normal')], ['1400', t('slow')]], String(state.settings.speed))}</label></div><p class="muted small">${t('offline')}</p>` : modal.type === 'delete' ? `<h2 id="modal-title">${t('deleteRecord')}</h2><div class="modal-actions">${button('close', t('cancel'))}${button('confirmDelete', t('confirmDelete'), 'btn primary')}</div>` : `<h2 id="modal-title">${t('share')}</h2><p>${t('shareHelp')}</p><textarea readonly id="share-link">${esc(modal.url)}</textarea>`;
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${button('close', '×', 'modal-close icon-button', `aria-label="${t('close')}"`)}${content}</section></div>`;
}
function schedule() {
  const b = state.current;
  if (page !== 'table' || modal || !b || b.status !== 'active' || seatToPlay(b) === 'S') return;
  timer = setTimeout(() => {
    if (state.current !== b || b.status !== 'active') return;
    const ctx = context(b), recommendation = decide(ctx).recommended;
    if (!recommendation) { b.status = 'stopped'; b.stopReason = 'coverage'; archive(); render(); return; }
    appendCall(recommendation.call);
  }, state.settings.speed);
}
function appendCall(call) {
  const b = state.current;
  if (!b || b.status !== 'active' || !legalCalls(b.history, seatToPlay(b)).includes(call)) return;
  const e = evaluate(context(b), call);
  b.history.push(e);
  if (e.seat === 'S' && e.feedback === 'mismatch') b.mistake = true;
  if (e.rule === 'uncovered') { b.status = 'stopped'; b.stopReason = 'userCall'; }
  else if (auctionEnded(b.history)) b.status = 'complete';
  resetUI(); archive(); render();
  if (e.seat === 'S' && state.settings.autoFeedback) toast(`${t(e.feedback)}${e.expected && e.expected !== call ? ` · ${t('expected')} ${callText(e.expected)}` : ''}`);
}
function endCurrent() { if (state.current?.status === 'active') { state.current.status = 'stopped'; state.current.stopReason = 'manual'; archive(); } }
async function start() {
  if (busy) return;
  const theme = setup.theme;
  if (['stayman', 'transfers'].includes(theme) && !selectedSystem('ns').conventions.includes(theme)) { toast(t('conventionRequired')); return; }
  busy = true; render();
  // Yield before generation so the loading state paints.
  await new Promise(resolve => setTimeout(resolve, 20));
  try {
    const systems = { NS: clone(selectedSystem('ns')), EW: clone(selectedSystem('ew')) };
    const hands = await generateHands(theme, systems.NS);
    endCurrent();
    if (setup.visibility !== 'custom') state.settings.visible = { N: setup.visibility !== 'solo', E: setup.visibility === 'all', W: setup.visibility === 'all' };
    state.current = { id: uid(), hands, history: [], systems, theme, dealer: theme === 'opening' ? 'S' : theme !== 'free' ? 'N' : setup.dealer === 'random' ? SEATS[Math.floor(Math.random() * 4)] : setup.dealer,
      vulnerability: setup.vulnerability === 'random' ? ['none', 'NS', 'EW', 'both'][Math.floor(Math.random() * 4)] : setup.vulnerability,
      created: Date.now(), assisted: Object.values(state.settings.visible).some(Boolean), favorite: false, mistake: false, note: '', status: 'active' };
    page = 'table'; resetUI(); save();
  } catch { toast(t('generationError')); }
  busy = false; render();
}
function replay(b) {
  const source = clone(b);
  endCurrent();
  state.current = { ...source, id: uid(), created: Date.now(), history: [], status: 'active', assisted: Object.values(state.settings.visible).some(Boolean), favorite: false, mistake: false, note: '' };
  page = 'table'; resetUI(); save(); render();
}
function download(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function focusModal() { queueMicrotask(() => root.querySelector('.modal button, .modal input')?.focus()); }

root.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  event.preventDefault();
  const action = el.dataset.action;
  const b = state.current;
  switch (action) {
    case 'nav': page = el.dataset.page; render(); window.scrollTo({ top: 0 }); return;
    case 'language': state.language = state.language === 'zh' ? 'en' : 'zh'; save(); render(); return;
    case 'settings': modal = { type: 'settings' }; render(); focusModal(); return;
    case 'close': modal = null; render(); return;
    case 'theme': setup.theme = el.dataset.theme; render(); return;
    case 'begin': await start(); return;
    case 'new': setup.theme = b?.theme || 'free'; await start(); return;
    case 'resume': page = 'table'; render(); return;
    case 'choose': selectedCall = el.dataset.call; render(); return;
    case 'submit': if (b && seatToPlay(b) === 'S') appendCall(selectedCall); return;
    case 'inspect': selectedEntry = Number(el.dataset.index); revealedReason = false; render(); return;
    case 'visibility': state.settings.visible[el.dataset.seat] = !state.settings.visible[el.dataset.seat]; if (state.settings.visible[el.dataset.seat] && b) b.assisted = true; save(); render(); return;
    case 'revealReason': revealedReason = true; if (b) b.assisted = true; archive(); render(); return;
    case 'hint': if (b?.status === 'active' && seatToPlay(b) === 'S') { hint = decide(context(b)).recommended || {}; b.assisted = true; save(); render(); } return;
    case 'undo': {
      const index = b?.history.findLastIndex(e => e.seat === 'S');
      if (index == null || index < 0) return;
      if (b.status !== 'active') { state.current = clone(b); state.current.id = uid(); state.current.created = Date.now(); }
      state.current.history = state.current.history.slice(0, index); state.current.status = 'active'; state.current.assisted = true; state.current.mistake = state.current.history.some(e => e.seat === 'S' && e.feedback === 'mismatch'); resetUI(); save(); render(); return;
    }
    case 'stop': endCurrent(); render(); return;
    case 'replay': if (b) replay(b); return;
    case 'favorite': if (b) b.favorite = !b.favorite; archive(); render(); return;
    case 'mistake': if (b) b.mistake = !b.mistake; archive(); render(); return;
    case 'exportDeal': if (b) download({ schema: 1, kind: 'board', board: b }, `bridge-deal-${b.id.slice(0, 6)}.json`); return;
    case 'backup': download({ ...state, schema: 1, kind: 'backup' }, 'bridge-studio-backup.json'); return;
    case 'share': {
      if (!b) return;
      const shared = { ...clone(b), note: '', favorite: false };
      const url = `${location.href.split('#')[0]}#deal=${encodeBoard(shared)}`;
      try { await navigator.clipboard.writeText(url); toast(t('copied')); } catch { modal = { type: 'share', url }; render(); focusModal(); }
      return;
    }
    case 'editSystem': draft = clone(state.systems.find(s => s.id === el.dataset.id)); draftDirty = false; render(); return;
    case 'duplicate': if (validateSystem(draft).length) { render(); toast(t('conflict')); return; } if (state.systems.length >= 100) return; draft = { ...clone(draft), id: uid(), name: draft.name.slice(0, 90) + (state.language === 'zh' ? ' · 副本' : ' · Copy'), version: 1 }; state.systems.push(clone(draft)); draftDirty = false; save(); render(); return;
    case 'saveSystem': {
      if (validateSystem(draft).length) { render(); toast(t('conflict')); return; }
      draft.version += 1;
      const index = state.systems.findIndex(s => s.id === draft.id);
      state.systems[index] = clone(draft); draftDirty = false; save(); render(); toast(t('saved')); return;
    }
    case 'reset': draft = { ...clone(DEFAULT_SYSTEM), id: draft.id, name: draft.name, version: draft.version }; draftDirty = true; render(); return;
    case 'deleteSystem': if (state.systems.length < 2) { toast(t('lastSystem')); return; } state.systems = state.systems.filter(s => s.id !== draft.id); for (const side of ['ns', 'ew']) if (state[side] === draft.id) state[side] = state.systems[0].id; draft = clone(state.systems[0]); draftDirty = false; save(); render(); return;
    case 'exportSystem': if (validateSystem(draft).length) { toast(t('conflict')); return; } download({ schema: 1, kind: 'system', system: draft }, 'bridge-system.json'); return;
    case 'import': document.querySelector('#import-file').click(); return;
    case 'recordFilter': recordFilter = el.dataset.filter; render(); return;
    case 'openRecord': endCurrent(); state.current = clone(state.records.find(r => r.id === el.dataset.id)); resetUI(); page = 'table'; save(); render(); return;
    case 'replayRecord': replay(state.records.find(r => r.id === el.dataset.id)); return;
    case 'deleteRecord': modal = { type: 'delete', id: el.dataset.id }; render(); focusModal(); return;
    case 'confirmDelete': state.records = state.records.filter(r => r.id !== modal.id); if (state.current?.id === modal.id) state.current = null; modal = null; save(); render(); return;
  }
});
root.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.setting) {
    const key = el.dataset.setting;
    if (key === 'fiveMajor') { draft.allowFiveMajor = el.checked; draftDirty = true; }
    else if (key.startsWith('visible-')) { state.settings.visible[key.slice(-1)] = el.checked; if (el.checked && state.current?.status === 'active') state.current.assisted = true; }
    else state.settings[key] = el.checked;
  } else if (el.dataset.convention) {
    draft.conventions = el.checked ? [...draft.conventions, el.dataset.convention] : draft.conventions.filter(id => id !== el.dataset.convention); draftDirty = true;
  } else if (el.name === 'ntRange') { draft.ntMin = Number(el.value); draft.ntMax = draft.ntMin + 2; draftDirty = true; }
  else if (el.name === 'speed') state.settings.speed = Number(el.value);
  else if (['ns', 'ew'].includes(el.name)) state[el.name] = el.value;
  else if (['visibility', 'dealer', 'vulnerability'].includes(el.name)) setup[el.name] = el.value;
  else if (el.name === 'libraryGroup') libraryGroup = el.value;
  else return;
  save(); render();
});
root.addEventListener('input', event => {
  const el = event.target;
  if (el.id === 'system-name') { draft.name = el.value; draftDirty = true; }
  if (el.id === 'review-note' && state.current) { state.current.note = el.value; archive(); }
  if (el.id === 'library-search') { libraryQuery = el.value; const pos = el.selectionStart; render(); const next = document.querySelector('#library-search'); next.focus(); next.setSelectionRange(pos, pos); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal) { modal = null; render(); return; }
  if (event.key === 'Tab' && modal) {
    const focusable = [...root.querySelectorAll('.modal button:not(:disabled), .modal input, .modal select, .modal textarea')];
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
document.querySelector('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('size');
    const payload = validatePayload(JSON.parse(await file.text()));
    const updated = clone(state);
    if (payload.kind === 'system') { const system = { ...payload.system, id: uid() }; updated.systems.push(system); draft = clone(system); page = 'system'; }
    if (payload.kind === 'board') { const board = { ...payload.board, id: uid() }; if (updated.current?.status === 'active') updated.records.unshift({ ...updated.current, status: 'stopped', stopReason: 'manual' }); updated.current = board; if (board.status !== 'active') updated.records.unshift(clone(board)); page = 'table'; resetUI(); }
    if (payload.kind === 'backup') {
      for (const system of payload.systems) { const existing = updated.systems.find(s => s.id === system.id); if (!existing) updated.systems.push(system); else if (JSON.stringify(existing) !== JSON.stringify(system)) updated.systems.push({ ...system, id: uid() }); }
      for (const board of payload.records) if (!updated.records.some(r => r.id === board.id)) updated.records.push(board);
      if (payload.current) { if (updated.current?.status === 'active') updated.records.unshift({ ...updated.current, status: 'stopped', stopReason: 'manual' }); updated.current = payload.current; }
    }
    if (updated.systems.length > 100 || updated.records.length > 500) throw new Error('size');
    state = updated; save(); render(); toast(t('importSuccess'));
  } catch { toast(t('invalidFile')); }
});
function readShared() {
  if (!location.hash.startsWith('#deal=')) return;
  try { const board = decodeBoard(location.hash.slice(6)); if (!board) throw new Error('board'); endCurrent(); state.current = { ...board, id: uid() }; page = 'table'; resetUI(); archive(); }
  catch { toast(t('invalidFile')); }
  history.replaceState(null, '', location.pathname + location.search);
}
window.addEventListener('hashchange', () => { readShared(); render(); });
readShared();
render();
if (loaded.error) toast(t('restoreNotice'));
