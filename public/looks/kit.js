/* Motion layer for design proposals H (spotlight) and I (aurora). Preview only.
   Loads the Motion library (motion.dev, vendored) and adds movement on top of the
   existing pages without changing what they do: everything stays a real link,
   button or form, works with the keyboard, and nothing moves when the system asks
   for reduced motion. */
(() => {
  const root = document.documentElement;
  const look = root.dataset.look;
  if (look !== "spotlight" && look !== "aurora") return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isPanel = () => document.body && document.body.classList.contains("sp");

  function boot() {
    if (window.Motion) return start(window.Motion);
    const s = document.createElement("script");
    s.src = "/looks/vendor/motion-14.10.1.js";
    s.onload = () => start(window.Motion);
    document.head.appendChild(s);
  }
  // Let React hydrate and portal.js fill the lists first.
  if (document.readyState === "complete") setTimeout(boot, 60);
  else addEventListener("load", () => setTimeout(boot, 60), { once: true });

  function start(M) {
    const { animate, inView, stagger, scroll, spring } = M;
    root.classList.add("kit-on");
    const ease = [0.22, 1, 0.36, 1];

    /* ---------- 1. Reveal on scroll, staggered (60fps: Stagger, Reveal) ---------- */
    const seen = new WeakSet();
    function reveal(els, opts = {}) {
      els = els.filter((e) => e && !seen.has(e) && e.offsetParent !== null);
      if (!els.length) return;
      els.forEach((e) => seen.add(e));
      if (reduce) return;
      const { y = 28, blur = 6, scale = 1, delay = 0.06 } = opts;
      els.forEach((e) => { e.style.opacity = "0"; });
      // Watch each element (a tall parent may never be 5% visible on a phone);
      // the ones that enter together animate one after another.
      let batch = [], raf = 0;
      const flush = () => {
        const list = batch; batch = []; raf = 0;
        animate(list,
          { opacity: [0, 1], y: [y, 0], scale: [scale, 1], filter: [`blur(${blur}px)`, "blur(0px)"] },
          { duration: 0.7, delay: stagger(delay), ease }
        ).then(() => list.forEach((e) => { e.style.filter = ""; e.style.transform = ""; }));
      };
      inView(els, (el) => {
        batch.push(el);
        if (!raf) raf = requestAnimationFrame(flush);
      }, { amount: "some", margin: "0px 0px -6% 0px" });
    }

    const PUBLIC_GROUPS = [
      [".sec-head", { y: 40 }],
      ["#wk1 > li, #wk2 > li", { y: 18, delay: 0.05 }],
      ["#most > li", { y: 40, scale: 0.94, delay: 0.07 }],
      ["#cats > .cat", { y: 50, delay: 0.08 }],
      ["#upcoming-months > *", { y: 30, delay: 0.05 }],
      [".rows > li", { y: 16, blur: 0, delay: 0.03 }],
      [".contact-grid > *", { y: 30, delay: 0.08 }],
      [".card, .step, .staff, .note", { y: 36, delay: 0.07 }],
      [".hero-sub, .week-panel, .kit-next", { y: 30, scale: 0.97, delay: 0.1 }],
    ];
    const PANEL_GROUPS = [
      [".sp-head", { y: 24 }],
      [".adm-main .adm-card, .adm-main .sp-row, .adm-main .sp-pv", { y: 30, delay: 0.07 }],
      [".sp-ev, .adm-doc, .rq, .sp-person, .adm-table tbody tr", { y: 14, blur: 0, delay: 0.03 }],
    ];
    function scan() {
      (isPanel() ? PANEL_GROUPS : PUBLIC_GROUPS).forEach(([sel, o]) => reveal($$(sel), o));
    }

    /* ---------- 2. Kinetic titles: words rise in, one after another ---------- */
    function kinetic(h) {
      if (!h || h.dataset.kit || reduce) return;
      h.dataset.kit = "1";
      const text = h.textContent.trim();
      if (!text || h.children.length) return;
      h.setAttribute("aria-label", text);
      h.innerHTML = text.split(/(\s+)/).map((w) => /^\s+$/.test(w) ? w
        : `<span class="kit-w" aria-hidden="true"><span class="kit-wi">${w.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</span></span>`).join("");
      animate($$(".kit-wi", h), { y: ["110%", "0%"], rotate: [6, 0], opacity: [0, 1] },
        { duration: 0.9, delay: stagger(0.08, { startDelay: 0.1 }), ease });
    }

    /* ---------- 3. Count-ups for numbers (60fps: Counter, Ticker) ---------- */
    function countUp(el) {
      if (!el || el.dataset.kitCount || reduce) return;
      const m = el.textContent.match(/^(\D*?)(\d{1,4})(\D.*)?$/s);
      if (!m) return;
      el.dataset.kitCount = "1";
      const to = +m[2], pre = m[1], post = m[3] || "";
      inView(el, () => {
        animate(0, to, { duration: 1.1, ease, onUpdate: (v) => { el.textContent = pre + Math.round(v) + post; } });
      });
    }

    /* ---------- 4. Magnetic buttons and tilt cards (pointer only) ---------- */
    function magnetic(el, strength = 0.25) {
      if (!finePointer || reduce || el.dataset.kitMag) return;
      el.dataset.kitMag = "1";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength;
        const y = (e.clientY - r.top - r.height / 2) * strength;
        animate(el, { x, y }, { type: spring, stiffness: 300, damping: 20 });
      });
      el.addEventListener("pointerleave", () => animate(el, { x: 0, y: 0 }, { type: spring, stiffness: 200, damping: 12 }));
    }
    function tilt(el, max = 8) {
      if (!finePointer || reduce || el.dataset.kitTilt) return;
      el.dataset.kitTilt = "1";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
        animate(el, { rotateX: (0.5 - py) * max, rotateY: (px - 0.5) * max, scale: 1.02 }, { type: spring, stiffness: 260, damping: 22 });
      });
      el.addEventListener("pointerleave", () => animate(el, { rotateX: 0, rotateY: 0, scale: 1 }, { type: spring, stiffness: 200, damping: 16 }));
    }
    // Cursor-following light on surfaces (CSS reads --mx/--my).
    function spotlight(el) {
      if (!finePointer || el.dataset.kitSpot) return;
      el.dataset.kitSpot = "1";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    }

    /* ---------- 5. Press feedback on every button (60fps: Tap, Spring Physics) ---------- */
    if (!reduce) {
      document.addEventListener("pointerdown", (e) => {
        const b = e.target.closest(".btn, .chip-link, .fchip, .seg button, .sp-edit, .sp-more, .kit-dock a, .most a, .ctile");
        if (!b) return;
        animate(b, { scale: 0.95 }, { duration: 0.1 });
        const up = () => { animate(b, { scale: 1 }, { type: spring, stiffness: 500, damping: 14 }); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
        addEventListener("pointerup", up); addEventListener("pointercancel", up);
      });
    }

    /* ---------- 6. Header: shrinks on scroll + reading progress line ---------- */
    const header = $(".site-header");
    if (header) {
      const bar = document.createElement("div");
      bar.className = "kit-progress";
      bar.setAttribute("aria-hidden", "true");
      document.body.appendChild(bar);
      if (!reduce) scroll(animate(bar, { scaleX: [0, 1] }, { ease: "linear" }));
      const onScroll = () => root.classList.toggle("kit-scrolled", scrollY > 40);
      addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    /* ---------- 7. "Next up" tile with a live countdown (from the real calendar data) ---------- */
    function nextUp() {
      const P = window.__PORTAL__;
      if (!P || !Array.isArray(P.events) || $(".kit-next")) return;
      const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const list = P.events.map((e, i) => { const [y, m, d] = e[0].split("-").map(Number); return { i, d: new Date(y, m - 1, d), title: e[2], detail: e[3] }; })
        .filter((e) => e.d >= today).sort((a, b) => a.d - b.d || a.i - b.i);
      const ev = list[0];
      if (!ev) return;
      const days = Math.round((ev.d - today) / 864e5);
      const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
      const a = document.createElement("a");
      a.className = "kit-next";
      a.href = `#ev-${ev.i}`;
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      a.innerHTML = `<span class="kit-next-k">Next up</span>
        <span class="kit-next-n" aria-hidden="true"><span class="kit-next-num">${days}</span><span class="kit-next-u">${days === 1 ? "day" : "days"}</span></span>
        <span class="kit-next-t">${esc(ev.title)}</span>
        <span class="kit-next-d">${when} · ${DOW[ev.d.getDay()]}, ${MON[ev.d.getMonth()]} ${ev.d.getDate()}</span>
        <span class="kit-next-go" aria-hidden="true">→</span>`;
      a.setAttribute("aria-label", `Next up: ${ev.title}, ${when.toLowerCase()}, ${DOW[ev.d.getDay()]} ${MON[ev.d.getMonth()]} ${ev.d.getDate()}`);
      // Open the calendar list and jump to the event, like the week panel does.
      const target = look === "spotlight" ? $(".hero-grid") : $(".hero-find");
      if (!target) return;
      if (look === "spotlight") target.insertBefore(a, $(".week-panel", target) || null);
      else target.appendChild(a);
      const num = $(".kit-next-num", a);
      if (!reduce && days > 0) animate(Math.min(days + 30, 99), days, { duration: 1.6, ease, onUpdate: (v) => { num.textContent = Math.round(v); } });
    }

    /* ---------- 8. Spotlight search (⌘K or "/"): the real search, lifted over the page ---------- */
    function searchPalette() {
      const actions = $(".bar-actions");
      if (!actions || $(".kit-k")) return;
      const form = $("#site-search");
      const base = (location.pathname.match(/^\/s\/[^/]+/) || [""])[0];
      const btn = document.createElement(form ? "button" : "a");
      btn.className = "kit-k";
      if (form) btn.type = "button"; else btn.href = `${base}/#search`;
      btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>Search</span><kbd aria-hidden="true">${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} K</kbd>`;
      btn.setAttribute("aria-label", "Search forms, events and policies");
      actions.insertBefore(btn, actions.firstChild);
      if (!form) return;
      const scrim = document.createElement("div");
      scrim.className = "kit-scrim";
      scrim.hidden = true;
      document.body.appendChild(scrim);
      const input = $("#q", form);
      let open = false;
      const show = () => {
        if (open) return; open = true;
        const r = form.getBoundingClientRect();
        root.classList.add("kit-palette");
        scrim.hidden = false;
        const r2 = form.getBoundingClientRect();
        if (!reduce) {
          animate(scrim, { opacity: [0, 1] }, { duration: 0.25 });
          animate(form, { x: [r.left - r2.left, 0], y: [r.top - r2.top, 0], scale: [r.width / r2.width, 1] }, { type: spring, stiffness: 260, damping: 26 });
        }
        input.focus();
      };
      const hide = () => {
        if (!open) return; open = false;
        root.classList.remove("kit-palette");
        scrim.hidden = true;
        form.style.transform = "";
        btn.focus();
      };
      btn.addEventListener("click", show);
      scrim.addEventListener("click", hide);
      addEventListener("keydown", (e) => {
        const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
        if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); open ? hide() : show(); }
        else if (e.key === "Escape" && open) hide();
      });
      form.addEventListener("click", (e) => { if (open && e.target.closest("#q-results a")) hide(); });
      if (location.hash === "#search") setTimeout(show, 300);
    }

    /* ---------- 9. Dock with magnification (aurora): the section links, at thumb height ---------- */
    function dock() {
      const nav = $(".main-nav");
      if (!nav || nav.dataset.kitDock) return;
      nav.dataset.kitDock = "1";
      nav.classList.add("kit-dock");
      const items = $$("a", nav);
      items.forEach((a) => {
        const h = (a.getAttribute("href") || "").toLowerCase();
        const kind = /week/.test(h) ? "week" : /document/.test(h) ? "docs" : /calendar/.test(h) ? "cal" : /contact/.test(h) ? "contact"
          : /volunteer/.test(h) ? "hand" : /favorite/.test(h) ? "star" : /wishlist/.test(h) ? "gift" : /messenger/.test(h) ? "mail" : "home";
        a.dataset.icon = kind;
      });
      if (!finePointer || reduce) return;
      nav.addEventListener("pointermove", (e) => {
        items.forEach((a) => {
          const r = a.getBoundingClientRect();
          const d = Math.abs(e.clientX - (r.left + r.width / 2));
          const s = 1 + Math.max(0, 1 - d / 160) * 0.28;
          animate(a, { scale: s, y: -(s - 1) * 26 }, { type: spring, stiffness: 400, damping: 24 });
        });
      });
      nav.addEventListener("pointerleave", () => animate(items, { scale: 1, y: 0 }, { type: spring, stiffness: 300, damping: 20 }));
    }

    /* ---------- 10. This week as a carousel (aurora): cards scale as they reach the centre ---------- */
    function carousel() {
      const lists = $$("#wk1, #wk2");
      if (!lists.length || reduce) return;
      lists.forEach((ul) => {
        if (ul.dataset.kitCar) return;
        ul.dataset.kitCar = "1";
        const upd = () => {
          const r = ul.getBoundingClientRect(); const c = r.left + r.width / 2;
          $$(":scope > li", ul).forEach((li) => {
            const b = li.getBoundingClientRect(); const d = Math.min(1, Math.abs(b.left + b.width / 2 - c) / r.width);
            li.style.setProperty("--kit-d", d.toFixed(3));
          });
        };
        ul.addEventListener("scroll", upd, { passive: true });
        upd();
        // Drag to scroll with the mouse (touch already scrolls).
        let down = null;
        ul.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") down = { x: e.clientX, s: ul.scrollLeft, moved: false }; });
        addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 4) down.moved = true; ul.scrollLeft = down.s - dx; });
        addEventListener("pointerup", () => { setTimeout(() => { down = null; }, 0); });
        ul.addEventListener("click", (e) => { if (down && down.moved) { e.preventDefault(); e.stopPropagation(); } }, true);
      });
    }

    /* ---------- 11. Panels: sliding pill under the current section ---------- */
    function panelPill() {
      const side = $(".sp-side");
      if (!side) return;
      let pill = $(".kit-pill", side);
      if (!pill) { pill = document.createElement("span"); pill.className = "kit-pill"; pill.setAttribute("aria-hidden", "true"); side.appendChild(pill); }
      const place = (animateIt) => {
        const a = $('.sp-group a[aria-current="page"]', side);
        if (!a || !a.offsetParent) { pill.style.opacity = "0"; return; }
        const rs = side.getBoundingClientRect(), ra = a.getBoundingClientRect();
        const to = { top: ra.top - rs.top + side.scrollTop, left: ra.left - rs.left, width: ra.width, height: ra.height };
        const prev = JSON.parse(sessionStorage.getItem("kit-pill") || "null");
        try { sessionStorage.setItem("kit-pill", JSON.stringify(to)); } catch {}
        pill.style.opacity = "1";
        Object.assign(pill.style, { top: to.top + "px", left: to.left + "px", width: to.width + "px", height: to.height + "px" });
        if (animateIt && prev && !reduce && prev.top !== to.top) {
          animate(pill, { y: [prev.top - to.top, 0], scaleY: [1.25, 1] }, { type: spring, stiffness: 320, damping: 26 });
        }
      };
      place(true);
      new MutationObserver(() => place(true)).observe(side, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
      addEventListener("resize", () => place(false));
    }

    /* ---------- Wire it all, and keep watching for content that arrives later ---------- */
    function decorate() {
      if (isPanel()) {
        kinetic($(".sp-head h1"));
        $$(".sp .btn--gold, .sp .btn--primary").forEach((b) => magnetic(b, 0.18));
        $$(".sp .adm-card").forEach(spotlight);
      } else {
        kinetic($("#hero-title") || $(".page-hero h1") || $(".hb-head h1"));
        $$(".site-footer h2, #contact-title").forEach((h) => h.classList.add("kit-big"));
        $$(".btn--gold, .btn-facts, .ctile").forEach((b) => magnetic(b, 0.2));
        $$("#most > li > a").forEach((a) => tilt(a, 10));
        $$(".cat, .week-panel, .hero-sub, .kit-next, .card, .step, .staff").forEach(spotlight);
        $$(".cat-top .caption").forEach(countUp);
        countUp($("#docs-intro"));
        if (look === "aurora") { dock(); carousel(); }
      }
      scan();
    }
    if (!isPanel()) { nextUp(); searchPalette(); }
    if (isPanel()) panelPill();
    decorate();
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(decorate, 50); })
      .observe(document.body, { childList: true, subtree: true });
  }
})();
