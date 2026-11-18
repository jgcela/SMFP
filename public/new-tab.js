/* Links to files (PDFs, flyers, images) and to other websites open in a new tab.
   Links between the portal's own pages (Home, School Messenger, Volunteer,
   Teacher wishlists, Staff favorites, handbooks, supply list…), links that
   stay on the same page (#calendar, #contact…), email (mailto:) and phone
   (tel:) links open as before, in the same tab. Runs on click, so it also covers
   the links the page scripts add later (documents, calendar, volunteer cards). */
(function () {
  var SAME_PAGE = /^(#|mailto:|tel:|sms:|javascript:)/i;
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.hasAttribute("data-same-tab")) return; // the school chose the same tab
    var href = a.getAttribute("href") || "";
    if (SAME_PAGE.test(href)) return;
    var url = new URL(a.href, location.href);
    if (url.origin === location.origin) {
      if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
      if (url.pathname === "/" || /_202627\.html$/.test(url.pathname)) return; // a portal page
    }
    a.target = "_blank";
    a.rel = "noopener";
  }, true);
})();
