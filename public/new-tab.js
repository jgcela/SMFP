/* Every link that leads to another page or file opens in a new tab.
   Links that stay on the same page (#calendar, #contact…), email (mailto:)
   and phone (tel:) links work as before. Runs on click, so it also covers
   the links the page scripts add later (documents, calendar, volunteer cards). */
(function () {
  var SAME_PAGE = /^(#|mailto:|tel:|sms:|javascript:)/i;
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (SAME_PAGE.test(href)) return;
    var url = new URL(a.href, location.href);
    if (url.hash && url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
    a.target = "_blank";
    a.rel = "noopener";
  }, true);
})();
