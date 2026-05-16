import type { ReportData } from "./types.js";

/** 리포트 HTML용 UX 레이어 (진행률·스크롤 스파이·모바일 네비·맨 위로) */
/** @deprecated styles live in src/report/css — bundled via report-styles.ts */

export const REPORT_UX_SCRIPT = `
    (function () {
      var fill = document.querySelector(".kca-progress-fill");
      var backTop = document.querySelector(".kca-back-top");
      var navLinks = document.querySelectorAll(".deck-nav a[data-kca-jump]");
      var sections = [];
      navLinks.forEach(function (a) {
        var id = a.getAttribute("data-kca-jump");
        var el = id && document.getElementById(id);
        if (el) sections.push({ el: el, link: a });
      });
      function onScroll() {
        var st = window.scrollY || document.documentElement.scrollTop;
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        if (fill) fill.style.width = Math.min(100, (st / max) * 100) + "%";
        if (backTop) backTop.hidden = st < 480;
        if (!sections.length) return;
        var probe = st + 150;
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
      onScroll();
      if (backTop) {
        backTop.addEventListener("click", function () {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
      function syncThemeButtons() {
        var mode = document.documentElement.getAttribute("data-theme") || "system";
        document.querySelectorAll(".theme-btn").forEach(function (btn) {
          var v = btn.getAttribute("data-theme-set") || "system";
          btn.classList.toggle("is-active", v === mode);
          btn.setAttribute("aria-pressed", v === mode ? "true" : "false");
        });
      }
      var obs = new MutationObserver(syncThemeButtons);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      syncThemeButtons();
    })();
`;

export function renderHeroQuickJumps(): string {
  return `<div class="hero-jumps" aria-label="바로가기">
    <a class="hero-jump" href="#s-wrapped" data-kca-jump="s-wrapped"><strong>⓪</strong> Wrapped</a>
    <a class="hero-jump" href="#s-viz" data-kca-jump="s-viz"><strong>④</strong> 차트</a>
    <a class="hero-jump" href="#s-facts" data-kca-jump="s-facts"><strong>①</strong> 숫자</a>
    <a class="hero-jump" href="#s-help" data-kca-jump="s-help">용어 설명</a>
  </div>`;
}

export function renderTopChrome(_data: ReportData, sectionNavHtml: string): string {
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

export function topicNavLink(data: ReportData): string {
  if (data.topics.length === 0) return "";
  return `<a href="#s-topics" data-kca-jump="s-topics">주제 맵</a>`;
}
