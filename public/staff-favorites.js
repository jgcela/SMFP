/* Staff favorites (step 6c): search by name or role, filter by team, and the
   card from the address (#staff-surname) highlighted. The cards come from the server. */
(function () {
  var q = document.getElementById('s-search');
  if (!q) return; // the sign-in notice
  var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var cards = all('#groups article.staff'), groups = all('#groups .staff-group'), pend = all('#pending [data-text]');
  var filter = 'all';
  var match = function (el, words) {
    var team = el.getAttribute('data-team') || '-';
    return (filter === 'all' || team === filter) && words.every(function (w) { return el.getAttribute('data-text').indexOf(w) >= 0; });
  };
  function render() {
    var words = norm(q.value).trim().split(/\s+/).filter(Boolean), shown = 0, pn = 0;
    cards.forEach(function (c) { var ok = match(c, words); c.hidden = !ok; if (ok) shown++; });
    groups.forEach(function (g) {
      var n = g.querySelectorAll('article.staff:not([hidden])').length;
      g.hidden = !n; var cap = g.querySelector('.caption'); if (cap) cap.textContent = n;
    });
    var first = true;
    pend.forEach(function (p) {
      var ok = match(p, words); p.hidden = !ok;
      var sep = p.previousElementSibling; if (sep && sep.className === 'sep') sep.hidden = !ok || first;
      if (ok) { pn++; first = false; }
    });
    var pl = document.getElementById('pending'); if (pl && pend.length) pl.hidden = !pn;
    document.getElementById('empty').hidden = shown + pn > 0;
    document.getElementById('count').textContent = 'Showing ' + shown + ' of ' + cards.length + ' staff members';
  }
  document.getElementById('filters').addEventListener('click', function (e) {
    var b = e.target.closest('.fchip'); if (!b) return;
    filter = b.getAttribute('data-f');
    all('#filters .fchip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });
  q.addEventListener('input', render);
  if (cards.length) render();
  if (location.hash) {
    var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (t && t.classList.contains('staff')) { t.classList.add('is-target'); t.scrollIntoView(); }
  }
})();
