/* School text pages (step 4e): menu, contents for long pages, and checklists
   whose ticks stay on this device. */
/* Shared: mobile menu + helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/(\d)–(\d)/g, '$1–\u2060$2');
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
(function () {
  const btn = $('.menu-btn'), menu = $('#mobile-menu');
  const set = (open) => { btn.setAttribute('aria-expanded', String(open)); menu.hidden = !open;
    btn.querySelector('use').setAttribute('href', open ? '#i-close' : '#i-menu');
    btn.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Menu'; };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
})();
/* Long pages: contents from the headings (h2–h4), current-section highlight, search, sidebar toggle.
   Same behaviour as the original handbook page. */
(function () {
  if (!$('#toc')) return; // short page: no contents
  const root = document.documentElement, doc = $('#doc'), side = $('#hb-side'), tog = $('#hb-toggle'), scrim = $('#hb-scrim');
  const hdr = document.querySelector('.site-header'), bar = $('.hb-bar');
  const setH = () => { root.style.setProperty('--hdr', (hdr ? hdr.offsetHeight : 0) + 'px'); root.style.setProperty('--bar', bar.offsetHeight + 'px'); };
  setH(); new ResizeObserver(setH).observe(bar); if (hdr) new ResizeObserver(setH).observe(hdr);

  // Contents.
  const heads = $$('h2, h3, h4, h5', doc).filter(h => h.id && !h.closest('.hb-head'));
  $('#toc').innerHTML = '<ol class="hb-toc">' + heads.map(h => {
    const lvl = +h.tagName[1] - 1, t = esc(h.textContent.replace(/\s+/g, ' ').trim());
    return `<li class="toc-l${lvl}"><a href="#${h.id}" title="${t}">${t}</a></li>`; }).join('') + '</ol>';

  // Sidebar: collapsible on desktop, drawer on small screens.
  const small = matchMedia('(max-width: 1000px)');
  const setOpen = (open) => {
    tog.setAttribute('aria-expanded', String(open));
    if (small.matches) { side.classList.toggle('is-open', open); scrim.hidden = !open; document.body.style.overflow = open ? 'hidden' : ''; if (open) { const a = $('#toc a[aria-current]') || $('#toc a'); a && a.focus({ preventScroll: true }); } }
    else { $('#hb').classList.toggle('is-collapsed', !open); scrim.hidden = true; document.body.style.overflow = ''; }
  };
  const reset = () => { side.classList.remove('is-open'); $('#hb').classList.remove('is-collapsed'); setOpen(!small.matches); };
  reset(); small.addEventListener('change', reset);
  tog.addEventListener('click', () => setOpen(tog.getAttribute('aria-expanded') !== 'true'));
  scrim.addEventListener('click', () => { setOpen(false); tog.focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && small.matches && side.classList.contains('is-open')) { setOpen(false); tog.focus(); } });
  $('#toc').addEventListener('click', (e) => { if (e.target.closest('a') && small.matches) setOpen(false); });

  // Current section.
  const links = new Map($$('#toc a').map(a => [a.getAttribute('href').slice(1), a]));
  let current = null;
  const mark = (a) => { if (!a || a === current) return; if (current) current.removeAttribute('aria-current'); a.setAttribute('aria-current', 'true'); current = a;
    const r = a.getBoundingClientRect(), s = side.getBoundingClientRect(); if (r.top < s.top + 40 || r.bottom > s.bottom - 20) side.scrollTop += r.top - s.top - s.height / 3; };
  const onScroll = () => { const y = (parseInt(getComputedStyle(root).getPropertyValue('--hdr')) || 0) + bar.offsetHeight + 24; let last = heads[0];
    for (const h of heads) { if (h.getBoundingClientRect().top - y <= 0) last = h; else break; } mark(links.get(last.id)); };
  let tick = false; addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { onScroll(); tick = false; }); } }, { passive: true }); onScroll();

  // Search.
  const blocks = []; let section = '';
  $$('h2, h3, h4, h5, p, li, td, th', doc).forEach((el, i) => {
    if (el.closest('.hb-head, .hb-top')) return;
    if (/^H[2-5]$/.test(el.tagName)) section = el.textContent.trim();
    if (el.closest('li') && el.tagName !== 'LI' && !/^H/.test(el.tagName)) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (text) { if (!el.id) el.id = 'b' + i; blocks.push({ el, text, n: norm(text), section }); }
  });
  const q = $('#doc-q'), box = $('#hb-results'), res = $('#doc-results'), count = $('#doc-count');
  const snippet = (t, w) => { const i = Math.max(0, norm(t).indexOf(w)); const a = Math.max(0, i - 60); return (a ? '…' : '') + t.slice(a, i + w.length + 90) + (i + w.length + 90 < t.length ? '…' : ''); };
  const run = () => {
    const words = norm(q.value).trim().split(/\s+/).filter(w => w.length > 1);
    if (!words.length) { box.hidden = true; count.textContent = ''; res.innerHTML = ''; return; }
    const hits = blocks.filter(b => words.every(w => b.n.includes(w)));
    count.textContent = hits.length ? `${hits.length} match${hits.length === 1 ? '' : 'es'}${hits.length > 40 ? ' · showing the first 40' : ''}` : 'No matches. Try another word.';
    res.innerHTML = hits.slice(0, 40).map(b => `<li><a href="#${b.el.id}"><span class="caption">${esc(b.section)}</span><span>${esc(snippet(b.text, words[0]))}</span></a></li>`).join('');
    box.hidden = false;
  };
  q.addEventListener('input', run);
  q.addEventListener('focus', () => { if (q.value.trim()) run(); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; run(); } });
  document.addEventListener('click', (e) => { if (!e.target.closest('.hb-search')) box.hidden = true; });
  res.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return;
    const t = document.getElementById(a.getAttribute('href').slice(1)); box.hidden = true; if (!t) return;
    $$('.is-hit').forEach(x => x.classList.remove('is-hit')); t.classList.add('is-hit'); });
})();
/* Checklists: families can tick items; the ticks stay on this device only. */
(function () {
  const boxes = $$('#doc li[data-type="taskItem"] input[type="checkbox"]');
  if (!boxes.length) return;
  const key = 'page-checks:' + location.pathname;
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
  boxes.forEach((b, i) => {
    b.disabled = false; b.checked = saved.includes(i);
    const li = b.closest('li'); li.classList.toggle('is-done', b.checked);
    const text = li.querySelector(':scope > div');
    if (text) { if (!text.id) text.id = 'chk-' + i; b.setAttribute('aria-labelledby', text.id); }
    li.addEventListener('click', (e) => { if (e.target === b || e.target.closest('a, label')) return; b.checked = !b.checked; b.dispatchEvent(new Event('change', { bubbles: true })); });
  });
  $('#doc').addEventListener('change', (e) => {
    if (!e.target.matches('li[data-type="taskItem"] input')) return;
    e.target.closest('li').classList.toggle('is-done', e.target.checked);
    try { localStorage.setItem(key, JSON.stringify(boxes.map((b, i) => b.checked ? i : -1).filter(i => i >= 0))); } catch (err) {}
  });
})();
