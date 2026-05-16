/** 리포트 HTML용 UX 레이어 (진행률·스크롤 스파이·모바일 네비·맨 위로) */
/** @deprecated styles live in src/report/css — bundled via report-styles.ts */
export const REPORT_UX_SCRIPT = `
    (function () {
      var fill = document.querySelector(".kca-progress-fill");
      var backTop = document.querySelector(".kca-back-top");
      var topbar = document.querySelector(".kca-topbar");
      var navLinks = document.querySelectorAll(".deck-nav a[data-kca-jump], .hero-jump[data-kca-jump]");
      var sections = [];
      navLinks.forEach(function (a) {
        var id = a.getAttribute("data-kca-jump");
        if (!id) return;
        var el = document.getElementById(id);
        if (!el) return;
        if (sections.some(function (s) { return s.el === el; })) return;
        sections.push({ el: el, link: a });
      });
      function topbarOffset() {
        return topbar ? topbar.getBoundingClientRect().height + 10 : 112;
      }
      function onScroll() {
        var st = window.scrollY || document.documentElement.scrollTop;
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        if (fill) fill.style.width = Math.min(100, (st / max) * 100) + "%";
        if (backTop) backTop.hidden = st < 480;
        if (!sections.length) return;
        var probe = st + topbarOffset();
        var current = sections[0];
        for (var i = 0; i < sections.length; i += 1) {
          if (sections[i].el.offsetTop <= probe) current = sections[i];
        }
        sections.forEach(function (s) {
          var on = s === current;
          s.link.classList.toggle("is-active", on);
          if (on) s.link.setAttribute("aria-current", "location");
          else s.link.removeAttribute("aria-current");
        });
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
      if (backTop) {
        backTop.addEventListener("click", function () {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
      var shell = document.querySelector(".deck-nav-shell");
      if (shell) {
        shell.addEventListener("toggle", function () {
          setTimeout(function () {
            onScroll();
            window.dispatchEvent(new Event("resize"));
          }, 60);
        });
      }
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce && typeof IntersectionObserver !== "undefined") {
        var reveal = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (en) {
              if (en.isIntersecting) {
                en.target.classList.add("is-inview");
                reveal.unobserve(en.target);
              }
            });
          },
          { rootMargin: "0px 0px -5% 0px", threshold: 0.05 },
        );
        var ri = 0;
        document.querySelectorAll(".card, .wrapped-card, .viz-card, .fact-card").forEach(function (el) {
          el.classList.add("kca-reveal");
          el.style.setProperty("--reveal-delay", Math.min(ri * 35, 280) + "ms");
          ri += 1;
          reveal.observe(el);
        });
      }
      function syncThemeButtons() {
        var mode = document.documentElement.getAttribute("data-theme") || "system";
        document.querySelectorAll(".theme-btn").forEach(function (btn) {
          var v = btn.getAttribute("data-theme-set") || "system";
          var on = mode === "system" ? v === "system" : v === mode;
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      var obs = new MutationObserver(function () {
        syncThemeButtons();
        setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 40);
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      syncThemeButtons();
    })();
`;
export function renderHeroQuickJumps() {
    return `<div class="hero-jumps" aria-label="바로가기">
    <a class="hero-jump" href="#s-wrapped" data-kca-jump="s-wrapped"><strong>⓪</strong> Wrapped</a>
    <a class="hero-jump" href="#s-viz" data-kca-jump="s-viz"><strong>④</strong> 차트</a>
    <a class="hero-jump" href="#s-facts" data-kca-jump="s-facts"><strong>①</strong> 숫자</a>
    <a class="hero-jump" href="#s-help" data-kca-jump="s-help">용어 설명</a>
  </div>`;
}
export function renderTopChrome(_data, sectionNavHtml) {
    return `<div class="kca-topbar" role="region" aria-label="리포트 도구">
    <div class="kca-progress" aria-hidden="true"><span class="kca-progress-fill"></span></div>
    <div class="toolbar anim-enter" role="toolbar" aria-label="표시 테마" style="--enter-delay:0s">
      <span class="toolbar-label">테마</span>
      <button type="button" class="theme-btn" data-theme-set="light" aria-pressed="false">라이트</button>
      <button type="button" class="theme-btn" data-theme-set="dark" aria-pressed="false">다크</button>
      <button type="button" class="theme-btn" data-theme-set="system" aria-pressed="false">시스템</button>
    </div>
    <details class="deck-nav-shell" open>
      <summary>섹션 메뉴 · 빠른 이동</summary>
      ${sectionNavHtml}
    </details>
  </div>
  <button type="button" class="kca-back-top" hidden aria-label="맨 위로 이동">↑</button>`;
}
export function topicNavLink(data) {
    if (data.topics.length === 0)
        return "";
    return `<a href="#s-topics" data-kca-jump="s-topics">주제 맵</a>`;
}
//# sourceMappingURL=report-ux.js.map