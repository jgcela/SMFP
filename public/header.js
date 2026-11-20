// Public header (step 9):
// 1. When a family is signed in, the "Family sign-in" button shows the
//    family's name and leads to "My family".
// 2. When the menu links and the buttons do not fit on one line (many links,
//    a long family name, a narrow window), the header switches to the
//    "Menu" button instead of breaking the links onto two lines.
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var wrap = header.querySelector('.bar .wrap');
  var nav = header.querySelector('.main-nav');

  function fit() {
    if (!wrap || !nav) return;
    header.classList.remove('nav-collapsed', 'fam-compact');
    if (getComputedStyle(nav).display === 'none') return; // phones: already the Menu button
    // First try a shorter family name on the button; only then use the Menu button.
    if (!fits()) header.classList.add('fam-compact');
    if (!fits()) header.classList.add('nav-collapsed');
  }

  function fits() {
    var actions = header.querySelector('.bar-actions');
    var tooWide = wrap.scrollWidth > wrap.clientWidth + 1;
    var overlap = actions && nav.getBoundingClientRect().right > actions.getBoundingClientRect().left;
    var twoLines = Array.prototype.some.call(nav.querySelectorAll('a'), function (a) { return a.getBoundingClientRect().height > 50; });
    return !(tooWide || overlap || twoLines);
  }

  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();

  var btns = document.querySelectorAll('.btn-family');
  if (!btns.length || !window.fetch) return;
  fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (me) {
      if (!me || !me.family) return;
      btns.forEach(function (b) {
        var label = b.querySelector('span');
        if (!label) return;
        label.textContent = me.family;
        label.className = 'fam-name';
        b.setAttribute('aria-label', 'My family: ' + me.family);
        b.setAttribute('title', me.family);
      });
      fit();
    })
    .catch(function () {});
})();
