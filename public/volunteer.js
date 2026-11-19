/* Volunteer page (step 6b): the filter chips. The cards come from the server. */
(function () {
  const chips = [...document.querySelectorAll('#filters .fchip')], cards = [...document.querySelectorAll('#opps .card')];
  const count = document.getElementById('count');
  const show = (f) => {
    let n = 0;
    cards.forEach((c) => { const on = f === 'all' || c.dataset.kind === f; c.hidden = !on; if (on) n++; });
    count.textContent = `Showing ${n} of ${cards.length} opportunities`;
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
  };
  document.getElementById('filters').addEventListener('click', (e) => { const b = e.target.closest('.fchip'); if (b) show(b.dataset.f); });
})();
