/* =========================================================
   DATA — comes from the database. The page puts it in
   window.__PORTAL__ before this script runs (see app/page.tsx).
   ========================================================= */
const PORTAL = window.__PORTAL__;
const CONFIG = PORTAL.config;       // googleCalendarId, officeEmail, alertDays
const DOCS = PORTAL.docs;           // groups of documents
const MOST_USED = PORTAL.mostUsed;  // [group id, position in group]
/* EVENTS — [date, category, title, details, badges, link, alertEnd]
   alertEnd (optional): last day with no school, used only by the alert banner
   category: noclasses | faith | academic | community | health */
const EVENTS = PORTAL.events;
const NOTICES = PORTAL.notices;     // notices written by the school (override the automatic one)

/* =========================================================
   APP
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/(\d)–(\d)/g, '$1–\u2060$2');

  // ---- Dates (AP style) ----
  const MON_AP = ['Jan.','Feb.','March','April','May','June','July','Aug.','Sept.','Oct.','Nov.','Dec.'];
  const MON_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DOW_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmtLong = (d) => `${DOW[d.getDay()]}, ${MON_AP[d.getMonth()]} ${d.getDate()}`;
  const fmtShort = (d) => `${MON_AP[d.getMonth()]} ${d.getDate()}`;
  const cleanTime = (s) => s.replace(/(\d)\s?(am|pm)\b/gi, (m, n, ap) => `${n} ${ap.toLowerCase() === 'am' ? 'a.m.' : 'p.m.'}`);

  // "Today" — can be overridden for testing with ?today=2026-11-10
  const qsToday = new URLSearchParams(location.search).get('today');
  const now = new Date();
  const today = qsToday && /^\d{4}-\d{2}-\d{2}$/.test(qsToday) ? parse(qsToday) : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ---- Event model ----
  const CAT_LABEL = { noschool:'No school', faith:'Faith', academic:'Academic', community:'Community', health:'Health' };
  const BADGE_CAT = { 'No School':'noschool', 'Faith':'faith', 'Academic':'academic', 'Community':'community', 'Health':'health' };
  const events = EVENTS.map((e, i) => {
    const [date, cat, title, detail, badges, url, end] = e;
    const b = badges ? badges.split('|') : [];
    const noon = /noon dismissal/i.test(title + ' ' + detail);
    const main = cat === 'noclasses' ? 'noschool' : cat;
    const cats = new Set([main, ...b.map(x => BADGE_CAT[x]).filter(Boolean)]);
    if (noon) cats.add('noschool');
    const tags = [...new Set(b.map(x => BADGE_CAT[x]).filter(Boolean))];
    if (!tags.length) tags.push(main);
    return { i, id:`ev-${i}`, d: parse(date), end: end ? parse(end) : null, date, cat: main, cats, title, detail: cleanTime(detail), url, important: b.includes('Important'), noon, tags };
  }).sort((a, b) => a.d - b.d || a.i - b.i);

  const tagHTML = (e) => {
    const t = e.tags.map(c => `<span class="tag tag--${c}">${c === 'noschool' ? 'No school' : CAT_LABEL[c]}</span>`);
    if (e.noon && !e.tags.includes('noschool')) t.unshift('<span class="tag tag--noschool">Noon dismissal</span>');
    if (e.important) t.push('<span class="tag tag--important">Important</span>');
    return `<span class="tags">${t.join('')}</span>`;
  };
  const isNoSchool = (e) => e.cats.has('noschool');

  // ---- Config-driven bits ----
  $$('.js-email').forEach(a => a.href = `mailto:${CONFIG.officeEmail}`);
  $$('.js-email-text').forEach(s => s.textContent = CONFIG.officeEmail);
  const calId = CONFIG.googleCalendarId.trim();
  $$('.js-sub-google').forEach(a => {
    if (calId) { a.href = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calId)}`; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.title = 'Coming soon'; }
  });
  $$('.js-sub-ics').forEach(a => {
    if (calId) a.href = `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`;
    else { a.setAttribute('aria-disabled', 'true'); a.removeAttribute('href'); a.title = 'Coming soon'; }
  });

  // ---- Mobile menu ----
  const menuBtn = $('.menu-btn'), menu = $('#mobile-menu');
  const setMenu = (open) => { menuBtn.setAttribute('aria-expanded', String(open)); menu.hidden = !open;
    menuBtn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu'); menuBtn.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Menu'; };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });

  // ---- Alert banner ----
  // A notice written by the school (database table "notices") wins; otherwise
  // the next no-school day within CONFIG.alertDays, taken from the calendar.
  const notice = NOTICES.find(n => (!n.from || parse(n.from) <= today) && (!n.until || parse(n.until) >= today));
  if (notice) {
    $('#alert-text').innerHTML = `<strong>${esc(notice.message)}</strong>`;
    $('#alert-link').textContent = notice.linkLabel;
    $('#alert-link').href = notice.linkHref || '#';
    $('#alert-link').hidden = !notice.linkHref; // the link is optional
    $('#alert').hidden = false;
  }
  const soon = !notice && CONFIG.alertDays > 0 && events.find(e => isNoSchool(e) && e.d >= today && e.d <= addDays(today, CONFIG.alertDays));
  if (soon) {
    const ord = (n) => n + ([11,12,13].includes(n % 100) ? 'th' : ({1:'st',2:'nd',3:'rd'}[n % 10] || 'th'));
    const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const s0 = soon.d, s1 = soon.end;
    const when = s1 && key(s1) !== key(s0)
      ? `${MON3[s0.getMonth()]} ${ord(s0.getDate())}–${s1.getMonth() !== s0.getMonth() ? MON3[s1.getMonth()] + ' ' : ''}${ord(s1.getDate())}`
      : `${MON3[s0.getMonth()]} ${ord(s0.getDate())}`;
    $('#alert-text').innerHTML = `<strong>${when}: ${esc(soon.title.replace(/\s*—\s*/g, ' – '))}</strong>`;
    $('#alert-link').href = `#${soon.id}`;
    $('#alert').hidden = false;
  }

  // ---- This week / next week ----
  const weekStart = addDays(today, -today.getDay());
  const w1End = addDays(weekStart, 6), w2Start = addDays(weekStart, 7), w2End = addDays(weekStart, 13);
  $('#today-label').textContent = `Today is ${fmtLong(today)}`;
  $('#wk1-label').textContent = `This week, ${fmtShort(weekStart)}–${w1End.getMonth() === weekStart.getMonth() ? w1End.getDate() : fmtShort(w1End)}`;
  $('#wk2-label').textContent = `Next week, ${fmtShort(w2Start)}–${w2End.getMonth() === w2Start.getMonth() ? w2End.getDate() : fmtShort(w2End)}`;
  const weekItem = (e, isSoon) => `<li><a class="ev-card" href="#${e.id}">
      <span class="date-chip${isSoon ? ' is-soon' : ''}"><span class="m">${MON_SHORT[e.d.getMonth()]}</span><span class="d">${e.d.getDate()}</span></span>
      <span class="ev-body"><span class="ev-title">${esc(e.title)}</span><span class="ev-meta">${DOW[e.d.getDay()]}${e.detail ? ', ' + esc(e.detail) : ''}</span></span>
      ${tagHTML(e)}</a></li>`;
  const w1 = events.filter(e => e.d >= today && e.d <= w1End);
  const w2 = events.filter(e => e.d >= w2Start && e.d <= w2End);
  $('#wk1').innerHTML = w1.length ? w1.map(e => weekItem(e, true)).join('') : '<li class="empty-note">Nothing else on the calendar this week.</li>';
  $('#wk2').innerHTML = w2.length ? w2.map(e => weekItem(e, false)).join('') : '<li class="empty-note">Nothing on the calendar next week.</li>';

  // ---- Documents ----
  // Only signed-in families and staff get the list; others see a sign-in notice instead.
  if ($('#cats')) {
  const DAY_MS = 864e5;
  const isNew = (it) => it.added && (today - parse(it.added)) / DAY_MS <= 30;
  const icon = (it) => it.type === 'ext' ? 'i-ext' : it.type === 'web' ? 'i-arrow' : 'i-dl';
  const docTotal = DOCS.reduce((n, c) => n + c.items.length, 0);
  $('#docs-intro').textContent = `${docTotal} forms, handbooks and flyers for ${CONFIG.year}, grouped by what you need to do.`;
  $('#most').innerHTML = MOST_USED.map(([c, i]) => { const it = DOCS.find(x => x.id === c).items[i];
    return `<li><a href="${esc(it.h)}"><svg class="icon" style="color:var(--navy);width:24px;height:24px" aria-hidden="true"><use href="#i-doc"/></svg><span class="t">${esc(it.t)}${it.d ? `<span class="desc">${esc(it.d)}</span>` : ''}</span><span class="meta">${esc(it.m)}</span></a></li>`; }).join('');
  const renderDocs = (q = '') => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const match = (it) => !words.length || words.every(w => (it.t + ' ' + (it.k || '')).toLowerCase().includes(w));
    let shown = 0;
    $('#cats').innerHTML = DOCS.map(c => {
      const items = c.items.filter(match); shown += items.length;
      if (!items.length) return '';
      const noun = c.id === 'forms' ? 'form' : c.id === 'flyers' ? 'flyer' : 'document';
      return `<section class="cat" id="cat-${c.id}" aria-labelledby="cat-${c.id}-t">
        <div class="cat-top"><h3 class="h3" id="cat-${c.id}-t">${esc(c.name)}</h3><span class="caption">${items.length} ${noun}${items.length > 1 ? 's' : ''}</span></div>
        <p class="small">${esc(c.desc)}</p>
        <ul class="doc-list">${items.map(it => `<li><a href="${esc(it.h)}"${it.type === 'ext' ? ' target="_blank" rel="noopener"' : ''}>
          <span>${esc(it.t)}${isNew(it) ? '<span class="badge-new">New</span>' : ''}${it.d ? `<span class="doc-desc">${esc(it.d)}</span>` : ''}</span>
          <span class="doc-meta">${esc(it.m)}<svg class="icon" aria-hidden="true"><use href="#${icon(it)}"/></svg>${it.type === 'ext' ? '<span class="sr-only">(opens in a new tab)</span>' : ''}</span></a></li>`).join('')}</ul></section>`;
    }).join('');
    $('#most-wrap').hidden = words.length > 0;
    $('#docs-empty').hidden = shown > 0;
    $('#doc-status').textContent = words.length ? `${shown} document${shown === 1 ? '' : 's'} found` : '';
  };
  renderDocs();
  $('#doc-filter').addEventListener('input', (e) => renderDocs(e.target.value));
  }

  // ---- Calendar ----
  const FILTERS = [['all','All events'],['noschool','No school & early dismissal'],['faith','Faith'],['academic','Academic'],['community','Community'],['health','Health']];
  let filter = 'all', showAll = false, view = 'list';
  $('#filters').innerHTML = FILTERS.map(([k, l]) => `<button type="button" class="fchip" data-f="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? '' : `<span class="sw sw--${k}" aria-hidden="true"></span>`}${l}</button>`).join('');
  $('#filters').addEventListener('click', (e) => { const b = e.target.closest('.fchip'); if (!b) return;
    filter = b.dataset.f; $$('.fchip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderList(); renderMonth(); });
  const passes = (e) => filter === 'all' || e.cats.has(filter);

  const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();
  const rowHTML = (e, past) => `<li class="row${isNoSchool(e) ? ' is-noschool' : ''}${past ? ' is-past' : ''}" id="${e.id}">
      <span class="row-date"><span class="d">${e.d.getDate()}</span><span class="w">${DOW_S[e.d.getDay()]}</span></span>
      <span class="row-body">${e.url ? `<a class="row-title" href="${esc(e.url)}"${/^https?:/.test(e.url) ? ' target="_blank" rel="noopener"' : ''}>${esc(e.title)}</a>` : `<span class="row-title">${esc(e.title)}</span>`}
      ${e.detail ? `<span class="small">${esc(e.detail)}</span>` : ''}<span class="sr-only">${fmtLong(e.d)}</span></span>${tagHTML(e)}</li>`;
  const groupHTML = (list, past) => {
    const groups = new Map();
    list.forEach(e => { const k = monthKey(e.d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    return [...groups.values()].map(g => `<div class="month"><h3 class="h3">${MON_FULL[g[0].d.getMonth()]} ${g[0].d.getFullYear()}</h3><ul class="rows">${g.map(e => rowHTML(e, past)).join('')}</ul></div>`).join('');
  };
  // A new year starts with an empty calendar: show one plain line until the school adds events.
  const noEvents = events.length === 0;
  if (noEvents) {
    $('#filters').hidden = true;
    $$('#calendar .seg, #calendar .js-sub-ics, #calendar .cal-status').forEach(x => { x.hidden = true; x.style.display = 'none'; });
  }
  const renderList = () => {
    if (noEvents) {
      $('#upcoming-months').innerHTML = `<p class="empty-note">The ${esc(CONFIG.year)} calendar will be posted here soon.${$('#calendar .pdf-link') ? ' Until then, see the full calendar (PDF) above.' : ''}</p>`;
      $('#toggle-past').hidden = true; $('#show-more').hidden = true; $('#cal-status-text').textContent = '';
      return;
    }
    const past = events.filter(e => e.d < today && passes(e));
    const up = events.filter(e => e.d >= today && passes(e));
    const months = [...new Set(up.map(e => monthKey(e.d)))];
    const limit = showAll ? Infinity : (months[1] ?? months[0] ?? 0);
    const visible = up.filter(e => monthKey(e.d) <= limit);
    $('#upcoming-months').innerHTML = visible.length ? groupHTML(visible, false) : '<p class="empty-note">No upcoming events of this type.</p>';
    $('#past-months').innerHTML = groupHTML(past, true);
    const tp = $('#toggle-past');
    tp.hidden = past.length === 0;
    const open = tp.getAttribute('aria-expanded') === 'true';
    tp.textContent = open ? `Hide ${past.length} past events` : `Show ${past.length} past events`;
    $('#cal-status-text').textContent = `Showing upcoming events from today, ${fmtLong(today)}.`;
    const rest = up.length - visible.length, more = $('#show-more');
    more.hidden = rest <= 0;
    if (rest > 0) { const lastM = up[up.length - 1].d; const nextM = up.find(e => monthKey(e.d) > limit).d;
      more.textContent = `Show ${MON_FULL[nextM.getMonth()]}–${MON_FULL[lastM.getMonth()]} ${lastM.getFullYear()} (${rest} more events)`; }
  };
  $('#toggle-past').addEventListener('click', (e) => { const b = e.currentTarget; const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open)); $('#past-months').hidden = !open; renderList(); });
  $('#show-more').addEventListener('click', () => { showAll = true; renderList(); });

  // Jump from "This week" / alert to a row, even if it is in a collapsed range
  const reveal = (id) => {
    const ev = events.find(e => e.id === id); if (!ev) return;
    if (view !== 'list') setView('list');
    if (!passes(ev)) { filter = 'all'; $$('.fchip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.f === 'all'))); }
    if (ev.d < today) { $('#toggle-past').setAttribute('aria-expanded', 'true'); $('#past-months').hidden = false; }
    else showAll = true;
    renderList();
    const row = document.getElementById(id); if (!row) return;
    $$('.row.is-target').forEach(r => r.classList.remove('is-target'));
    row.classList.add('is-target'); row.setAttribute('tabindex', '-1');
    row.scrollIntoView({ block: 'center' }); row.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#ev-"]'); if (!a) return; e.preventDefault(); reveal(a.getAttribute('href').slice(1)); });

  // Month view
  const first = noEvents ? today : events[0].d, last = noEvents ? today : events[events.length - 1].d;
  const minM = monthKey(first), maxM = monthKey(last);
  let curM = Math.min(Math.max(monthKey(today), minM), maxM);
  let selDay = null;
  const renderMonth = () => {
    const y = Math.floor(curM / 12), m = curM % 12;
    $('#m-title').textContent = `${MON_FULL[m]} ${y}`;
    $('#m-prev').disabled = curM <= minM; $('#m-next').disabled = curM >= maxM;
    const start = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    events.filter(e => e.d.getFullYear() === y && e.d.getMonth() === m && passes(e)).forEach(e => (byDay[e.d.getDate()] ||= []).push(e));
    let html = '<tr>', col = 0;
    for (let i = 0; i < start.getDay(); i++, col++) html += '<td class="out"></td>';
    for (let d = 1; d <= days; d++, col++) {
      if (col && col % 7 === 0) html += '</tr><tr>';
      const date = new Date(y, m, d), list = byDay[d] || [], isToday = key(date) === key(today);
      if (list.length) {
        const label = `${fmtLong(date)}${isToday ? ' (today)' : ''}: ${list.length} event${list.length > 1 ? 's' : ''}`;
        html += `<td class="${isToday ? 'is-today' : ''}"><button type="button" class="dbtn" data-day="${d}" aria-pressed="${selDay === key(date)}" aria-label="${label}">
          <span class="dnum">${d}</span><span class="dots">${list.slice(0, 4).map(e => `<i class="dot dot--${isNoSchool(e) ? 'noschool' : e.cat}"></i>`).join('')}</span>
          <span class="dcount">${list.length === 1 ? esc(list[0].title.length > 22 ? list[0].title.slice(0, 21) + '…' : list[0].title) : list.length + ' events'}</span></button></td>`;
      } else {
        html += `<td class="${isToday ? 'is-today' : ''}"><span class="dplain"><span class="dnum">${d}</span>${isToday ? '<span class="sr-only"> (today)</span>' : ''}</span></td>`;
      }
    }
    while (col % 7) { html += '<td class="out"></td>'; col++; }
    $('#m-grid tbody').innerHTML = html + '</tr>';
    const sel = selDay && parse(selDay);
    if (sel && sel.getFullYear() === y && sel.getMonth() === m && byDay[sel.getDate()]) {
      $('#m-day').innerHTML = `<h3 class="h3">${fmtLong(sel)}</h3><ul class="rows" style="list-style:none;margin:0;padding:0;border-top:1px solid var(--gray)">${byDay[sel.getDate()].map(e => rowHTML(e, e.d < today).replace(`id="${e.id}"`, '')).join('')}</ul>`;
    } else $('#m-day').innerHTML = '<p class="small">Select a highlighted day to see its events.</p>';
  };
  $('#m-grid').addEventListener('click', (e) => { const b = e.target.closest('.dbtn'); if (!b) return;
    const y = Math.floor(curM / 12), m = curM % 12; selDay = key(new Date(y, m, Number(b.dataset.day))); renderMonth();
    const again = $(`.dbtn[data-day="${b.dataset.day}"]`); again && again.focus(); });
  $('#m-prev').addEventListener('click', () => { if (curM > minM) { curM--; selDay = null; renderMonth(); } });
  $('#m-next').addEventListener('click', () => { if (curM < maxM) { curM++; selDay = null; renderMonth(); } });

  const setView = (v) => { view = v; $('#view-list').setAttribute('aria-pressed', String(v === 'list')); $('#view-month').setAttribute('aria-pressed', String(v === 'month'));
    $('#list-view').hidden = v !== 'list'; $('#month-view').hidden = v !== 'month'; if (v === 'month') renderMonth(); };
  $('#view-list').addEventListener('click', () => setView('list'));
  $('#view-month').addEventListener('click', () => setView('month'));
  renderList();

  // ---- Site search (documents + events) ----
  const index = [
    ...DOCS.flatMap(c => c.items.map(it => ({ title: it.t, kind: it.m, href: it.h, text: (it.t + ' ' + (it.k || '') + ' ' + c.name).toLowerCase(), ext: it.type === 'ext' }))),
    ...events.filter(e => e.d >= today).map(e => ({ title: e.title, kind: fmtShort(e.d), href: '#' + e.id, text: (e.title + ' ' + e.detail + ' ' + [...e.cats].map(c => CAT_LABEL[c]).join(' ')).toLowerCase() }))
  ];
  const q = $('#q'), res = $('#q-results'), status = $('#q-status');
  const runSearch = () => {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) { res.hidden = true; status.textContent = ''; return; }
    const hits = index.filter(r => words.every(w => r.text.includes(w))).slice(0, 8);
    res.hidden = false;
    res.innerHTML = hits.length
      ? `<ul>${hits.map(h => `<li><a href="${esc(h.href)}"${h.ext ? ' target="_blank" rel="noopener"' : ''}><span>${esc(h.title)}</span><span class="kind">${esc(h.kind)}</span></a></li>`).join('')}</ul>`
      : `<p class="empty">No results for “${esc(q.value)}”. Try another word or <a href="#contact">contact the front office</a>.</p>`;
    status.textContent = hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'No results';
  };
  q.addEventListener('input', runSearch);
  $('#site-search').addEventListener('submit', (e) => { e.preventDefault(); const firstLink = $('a', res); if (firstLink) firstLink.focus(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; runSearch(); } if (e.key === 'ArrowDown') { const a = $('a', res); if (a) { e.preventDefault(); a.focus(); } } });
  res.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) { res.hidden = true; } });
})();
