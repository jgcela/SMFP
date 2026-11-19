/* Teacher wishlists (step 6d): search by teacher, class or group, filter by group, and
   the list from the address (#wl-N) highlighted. The lists come from the server. */
(function () {
  var q = document.getElementById('t-search');
  if (!q) return; // the sign-in notice
  var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var cards = all('#groups article.wl'), groups = all('#groups .wl-group');
  var filter = 'all';
  function render() {
    var words = norm(q.value).trim().split(/\s+/).filter(Boolean), shown = 0;
    cards.forEach(function (c) {
      var g = c.getAttribute('data-group') || '-', t = c.getAttribute('data-text');
      var ok = (filter === 'all' || g === filter) && words.every(function (w) { return t.indexOf(w) >= 0; });
      c.hidden = !ok; if (ok) shown++;
    });
    groups.forEach(function (s) {
      var n = s.querySelectorAll('article.wl:not([hidden])').length, cap = s.querySelector('.caption');
      s.hidden = !n; if (cap) cap.textContent = n + ' ' + (n === 1 ? cap.getAttribute('data-one') : cap.getAttribute('data-many'));
    });
    document.getElementById('empty').hidden = shown > 0;
    document.getElementById('count').textContent = 'Showing ' + shown + ' of ' + cards.length + ' wishlists';
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
    if (t && t.classList.contains('wl')) { t.classList.add('is-target'); t.scrollIntoView(); }
  }
})();
