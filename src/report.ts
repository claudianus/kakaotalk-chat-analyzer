import { resolveBubbleOverlaps } from "./bubble-layout.js";
import { SYSTEM_NOTICE_LABELS } from "./system-notices.js";
import type {
  ActivityArcSegment,
  CountItem,
  DailyCount,
  DailyRoomPulse,
  ParticipantStat,
  ReportData,
  RoomEventStats,
} from "./types.js";
import {
  GH_CONTRIB_SCRIPT,
  buildOgDescription,
  renderStoryHeadline,
  renderStorySections,
  storyNavLinks,
} from "./report-story.js";
import {
  CHART_CDN_BODY,
  CHARTS_INIT_SCRIPT,
  renderChartDeck,
  serializeChartPayload,
  serializeExplorerPayload,
} from "./report-charts.js";
import { escapeHtml, formatNumber, formatReplyGapMinutes, renderHighlightLine } from "./report-util.js";
import { REPORT_HEAD_LINKS } from "./report-head.js";
import { REPORT_STYLES } from "./report-styles.js";
import {
  REPORT_EXPLORER_SCRIPT,
  REPORT_UX_SCRIPT,
  renderHeroQuickJumps,
  renderTopChrome,
  topicNavLink,
} from "./report-ux.js";
import { topicsForDisplay } from "./report-chart-util.js";
import { renderInnovationDeck } from "./report-innovation.js";
import {
  formatGeneratorLine,
  formatProvenanceDetails,
} from "./report-provenance.js";
import { VERSION } from "./version.js";

const FIVE_MIB = 5 * 1024 * 1024;

export function renderReportHtml(data: ReportData): string {
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="${escapeHtml(buildOgDescription(data))}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(data.source.chatRoomName)} · kca 리포트">
  <meta property="og:description" content="${escapeHtml(buildOgDescription(data))}">
  <meta name="generator" content="kakaotalk-chat-analyzer ${escapeHtml(data.provenance?.generator.version ?? VERSION)}">
  <!-- kca-version:${escapeHtml(data.provenance?.generator.version ?? VERSION)} -->
  <title>카카오톡 대화 리포트 · ${escapeHtml(data.source.chatRoomName)} · kca</title>
  ${REPORT_HEAD_LINKS}
  <style>
    ${REPORT_STYLES}
  </style>
</head>
<body class="kca-oled">
  <a class="skip-link" href="#s-wrapped" data-kca-jump="s-wrapped">Wrapped로 건너뛰기</a>
  <main>
    ${renderTopChrome(data, renderSectionNav(data))}
    <header id="s-story" class="hero anim-enter" style="--enter-delay:0.03s;margin-bottom:16px">
      <div>
        <h1>카카오톡 대화 리포트</h1>
        <p class="room-title" aria-label="채팅방 이름">${escapeHtml(data.source.chatRoomName)}</p>
        ${renderStoryHeadline(data)}
        <p class="sub">원문·전체 URL은 저장하지 않아요. <strong>⓪ Wrapped</strong>로 한 장면씩 보거나, 아래 숫자·차트로 깊게 들어가면 됩니다.</p>
        ${renderHeroQuickJumps()}
        <div class="badge-row">
          <span class="badge">프라이버시: ${escapeHtml(privacyLabel(data.privacy))}</span>
          <span class="badge">인코딩: ${escapeHtml(data.source.encoding)}</span>
          <span class="badge">경고: ${data.source.warnings}건</span>
        </div>
      </div>
      <div class="card side-card">
        <p><strong>채팅방</strong><br>${escapeHtml(data.source.chatRoomName)}</p>
        <p><strong>생성 시각</strong><br>${escapeHtml(formatTimestamp(data.generatedAt))}</p>
        ${data.buildTiming ? `<p><strong>생성 소요</strong><br>${escapeHtml(formatBuildTiming(data.buildTiming))}</p>` : ""}
        ${renderProvenanceSideCard(data)}
        <p><strong>첫 메시지</strong><br>${escapeHtml(data.summary.firstMessage ?? "—")}</p>
        <p><strong>마지막 메시지</strong><br>${escapeHtml(data.summary.lastMessage ?? "—")}</p>
        ${renderProvenanceDetailsBlock(data)}
      </div>
    </header>
    ${renderStorySections(data)}
    ${renderInnovationDeck(data)}
    ${renderFactMatrix(data)}

    ${
      data.highlights.length > 0
        ? `<section id="s-hl" class="card anim-enter" style="margin-bottom:16px;--enter-delay:0.05s"><h2>하이라이트</h2><p class="chart-hint" style="margin-top:-4px">대화에서 눈에 띈 <strong>짧은 요약</strong>이에요. 아래 차트와 같이 보면 맥락이 잡힙니다.</p><ul class="highlights">${data.highlights.map((h) => `<li>${renderHighlightLine(h)}</li>`).join("")}</ul></section>`
        : ""
    }

    ${renderInsightDeck(data)}

    ${renderTopicMap(data)}

    ${renderChartDeck(data)}

    <div id="s-charts" class="chart-stack anim-enter" style="--enter-delay:0.07s">
    ${
      data.story.calendarWeeks.length > 0
        ? ""
        : `<section class="grid two" style="margin-bottom:14px">
      ${panel("일별 활동 (CSS)", "Wrapped 잔디와 별도로, 날짜 칸 색으로 본 일별 히트맵이에요.", renderDaily(data.daily, data.burstDays))}
      ${panel("시간대 리듬 (0~23시)", "청록=오전, 주황=오후. 막대 높이는 해당 시간 메시지 비중이에요.", renderHours(data.hourly))}
    </section>`
    }
    <section class="grid two" style="margin-bottom:14px">
      ${panel(`참여자 랭킹 · 상위 ${formatNumber(Math.min(data.participants.length, 40))} / 전체 ${formatNumber(data.participants.length)}`, "누가 얼마나 보냈는지 비율과 평균 길이를 함께 봐요.", renderParticipants(data.participants))}
      ${panel("첨부 유형", "사진·동영상 등 메타 유형 비중이에요.", renderCountBars(data.attachments))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${renderKeywordCssFold(data)}
      ${panel("자주 나온 도메인", "공유 링크 호스트 상위", renderCountBars(data.domains.slice(0, 24)))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("카카오톡 시스템·운영 알림", "입·퇴장, 삭제·가림, 강퇴 등 시스템 문구를 본문과 분리해 집계합니다. 아래 막대는 일별 운영·유입 펄스예요.", renderRoomEvents(data.roomEvents, data.summary.totalMessages, data.roomPulse))}
      ${panel("리액션·반복 문구", "ㅋㅋ만 보낸 메시지와 똑같은 문장 반복(3회 이상)입니다.", renderReactionsPanel(data))}
    </section>
    ${renderShopSearchSection(data)}
    </div>

    ${renderSelfServeCallout()}
    ${renderHelpGlossary()}

    <script>
    (function () {
      var KEY = "kca-report-theme";
      var root = document.documentElement;
      function syncBtns(mode) {
        var m = mode || "system";
        document.querySelectorAll(".theme-btn").forEach(function (btn) {
          var tv = btn.getAttribute("data-theme-set") || "system";
          var on = m === "system" ? tv === "system" : tv === m;
          btn.classList.toggle("is-active", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
      function apply(v) {
        if (v === "system" || !v) {
          root.removeAttribute("data-theme");
          try {
            localStorage.removeItem(KEY);
          } catch (e) {}
        } else {
          root.setAttribute("data-theme", v);
          try {
            localStorage.setItem(KEY, v);
          } catch (e) {}
        }
        syncBtns(v || "system");
      }
      try {
        var s = localStorage.getItem(KEY);
        if (s === "dark" || s === "light") root.setAttribute("data-theme", s);
        syncBtns(s || "system");
      } catch (e) {
        syncBtns("system");
      }
      document.querySelectorAll(".theme-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          apply(btn.getAttribute("data-theme-set") || "system");
        });
      });
    })();
    </script>
    <script>
    ${REPORT_UX_SCRIPT}
    </script>
    <script>
    (function () {
      var reduce = false;
      try {
        reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}
      function jumpTo(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
      document.querySelectorAll("[data-kca-jump]").forEach(function (link) {
        link.addEventListener("click", function (ev) {
          var id = link.getAttribute("data-kca-jump");
          if (!id || !document.getElementById(id)) return;
          ev.preventDefault();
          jumpTo(id);
        });
      });
      var initial = (location.hash || "").replace(/^#/, "");
      if (initial && document.getElementById(initial)) {
        try {
          history.replaceState(null, "", location.pathname + location.search);
        } catch (e) {}
        requestAnimationFrame(function () {
          jumpTo(initial);
        });
      }
    })();
    </script>
    <script>
    (function () {
      function inFrame() {
        try {
          return window.self !== window.top;
        } catch (e) {
          return true;
        }
      }
      function openExternal(url, ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        var opened = null;
        try {
          opened = window.open(url, "_blank", "noopener,noreferrer");
        } catch (e) {}
        if (opened) {
          try {
            opened.opener = null;
          } catch (e2) {}
          return;
        }
        // iframe에서는 window.open이 성공해도 null을 반환하는 경우가 있어
        // 부모/현재 창으로 이동시키면 BrewPage가 흰 화면이 됩니다.
        if (!inFrame()) {
          window.location.href = url;
        }
      }
      document.querySelectorAll("a[data-kca-external]").forEach(function (link) {
        var url = link.getAttribute("data-kca-external-url");
        if (!url || !/^https?:/i.test(url)) return;
        link.addEventListener("click", function (ev) {
          openExternal(url, ev);
        });
        link.addEventListener("auxclick", function (ev) {
          if (ev.button === 1) openExternal(url, ev);
        });
      });
    })();
    </script>
    <script>
    ${GH_CONTRIB_SCRIPT}
    </script>
    <script type="application/json" id="kca-chart-data">${serializeChartPayload(data)}</script>
    <script type="application/json" id="kca-explorer-data">${serializeExplorerPayload(data)}</script>
    ${CHART_CDN_BODY}
    <script>
    ${CHARTS_INIT_SCRIPT}
    </script>
    <script>
    ${REPORT_EXPLORER_SCRIPT}
    </script>

    ${data.provenance ? `<script type="application/json" id="kca-provenance">${JSON.stringify(data.provenance)}</script>` : ""}
    <footer>${renderProvenanceFooterPrefix(data)}${escapeHtml(data.source.chatRoomName)} · ${escapeHtml(data.source.fileName)} · 경고 ${data.source.warnings}건${data.buildTiming ? ` · 생성 ${escapeHtml(formatBuildTimingShort(data.buildTiming))}` : ""} · 본 리포트는 통계·참고용이며 법적·회계적 증빙으로 쓸 수 없습니다 · <span title="HTML 단일 파일">kca 리포트</span></footer>
  </main>
</body>
</html>`;

  const size = Buffer.byteLength(html, "utf8");
  if (size > FIVE_MIB) {
    throw new Error(`Generated HTML is ${size} bytes, which exceeds the 5 MiB BrewPage HTML limit.`);
  }
  return html;
}

function renderSectionNav(data: ReportData): string {
  const hl =
    data.highlights.length > 0 ? `<a href="#s-hl" data-kca-jump="s-hl">하이라이트</a>` : "";
  return `<nav class="deck-nav anim-enter" aria-label="섹션 바로가기" style="--enter-delay:0.02s">
    <span class="deck-nav-h">빠른 이동</span>
    ${storyNavLinks(data)}
    <a href="#s-narrative" data-kca-jump="s-narrative">방 프로필</a>
    <a href="#s-timeline" data-kca-jump="s-timeline">타임라인</a>
    <a href="#s-facts" data-kca-jump="s-facts">① 숫자 요약</a>
    <a href="#s-story" data-kca-jump="s-story">개요</a>
    <a href="#s-dyad" data-kca-jump="s-dyad">상호작용</a>
    <a href="#s-compare" data-kca-jump="s-compare">기간 비교</a>
    <a href="#s-explorer" data-kca-jump="s-explorer">기간 탐색</a>
    ${hl}
    ${topicNavLink(data)}
    <a href="#s-ai" data-kca-jump="s-ai">③ 분위기·리듬</a>
    <a href="#s-viz" data-kca-jump="s-viz">④ 인터랙티브 차트</a>
    <a href="#s-charts" data-kca-jump="s-charts">⑤ 표·막대 모음</a>
    <a href="#s-help" data-kca-jump="s-help">⑥ 용어 설명</a>
  </nav>`;
}

function renderHelpGlossary(): string {
  return `<section id="s-help" class="glossary anim-enter" aria-label="용어 설명" style="--enter-delay:0.08s">
    <details>
      <summary>용어가 낯설 때 — 한 번에 펼쳐보기</summary>
      <dl>
        <dt>지니 계수</dt><dd>참여가 얼마나 한쪽에 쏠렸는지 0~1에 가까운 숫자예요. 0에 가까우면 비슷하게 나눠 말하고, 높을수록 소수가 더 많이 말한 편이에요.</dd>
        <dt>응답 상위 10%</dt><dd>메시지 사이 시간 간격을 작은 순으로 줄 세웠을 때, 느린 쪽 10% 지점 값이에요. “가끔 아주 느린 응답”이 있는지 볼 때 씁니다.</dd>
        <dt>링크 다양성(bit)</dt><dd>공유한 링크가 몇 종류 사이트로 퍼져 있는지 요약한 값이에요. 높을수록 여러 종류의 사이트가 나온 거예요.</dd>
        <dt>리듬 점수</dt><dd>활동일·메시지 밀도·시간대 분산 등을 섞은 내부 요약 점수(0~100)로, “이 방이 얼마나 꾸준히 살아 있는지” 감으로 보기 위한 지표입니다.</dd>
        <dt>화자 전환 (100메시지당)</dt><dd>말하는 사람이 바뀐 횟수를 메시지 100개당으로 나눈 거예요. 숫자가 클수록 빠르게 교대하며 대화하는 스타일에 가깝습니다.</dd>
      </dl>
    </details>
  </section>`;
}

function renderFactMatrix(data: ReportData): string {
  const s = data.summary;
  const ins = data.insights;
  const density = ins.densityMessagesPerCalendarDay;
  const perActive = s.messagesPerActiveDay;
  const densityDup =
    density !== null &&
    perActive > 0 &&
    Math.abs(density - perActive) / perActive < 0.02;
  const densityRows: [string, string][] = densityDup
    ? [["활동일당 메시지", String(perActive)]]
    : [
        ["일평균(활동일)", String(perActive)],
        ["달력 밀도", density === null ? "—" : String(density)],
      ];
  const cells: [string, string][] = [
    ["총 메시지", formatNumber(s.totalMessages)],
    ["참여자", formatNumber(s.participants)],
    ["활동일", formatNumber(s.activeDays)],
    ...densityRows,
    ["링크·100", String(ins.linksPer100)],
    ["첨부·100", String(ins.attachmentsPer100)],
    ["사진÷첨부%", ins.photoShareOfAllAttachmentMarkers === null ? "—" : `${ins.photoShareOfAllAttachmentMarkers}%`],
    ["리듬 점수", `${ins.rhythmScore}/100`],
    ["주말%", `${ins.weekendSharePercent}%`],
    ["심야%", `${s.nightSharePercent}%`],
    ["1분내 응답%", ins.burstGapUnder1mPercent === null ? "—" : `${ins.burstGapUnder1mPercent}%`],
    ["독백 3연속+%", `${ins.monologueMessagesPercent}%`],
    ["응답 간격 중앙", formatReplyGapMinutes(s.medianReplyGapMinutes)],
    ["응답 상위10%", ins.replyGapP90Minutes === null ? "—" : formatReplyGapMinutes(ins.replyGapP90Minutes)],
    ["피크 시각", s.peakHour === null ? "—" : `${s.peakHour}시`],
    ["최장 연속일", String(s.longestActiveStreakDays)],
    ["상위3 점유", `${ins.top3ParticipantSharePercent}%`],
    ["참여 지니", ins.participantGini === null ? "—" : String(ins.participantGini)],
    ["화자전환·100", String(ins.speakerSwitchRatePer100)],
    ["질문 느낌·100", String(ins.questionLikeMessagesPer100)],
    ["이모지", formatNumber(s.emojiMessages)],
    ["평균 길이", String(s.averageMessageLength)],
  ];
  const inner = cells
    .map(
      ([k, v]) =>
        `<div class="fact-cell"><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`,
    )
    .join("");
  const strip = `<div class="fact-hero-strip" aria-label="핵심 숫자 세 가지">
    <div class="fact-hero-cell"><b>총 메시지</b><span>${escapeHtml(formatNumber(s.totalMessages))}</span></div>
    <div class="fact-hero-cell"><b>참여자</b><span>${escapeHtml(formatNumber(s.participants))}</span></div>
    <div class="fact-hero-cell"><b>리듬 점수</b><span>${escapeHtml(String(ins.rhythmScore))}<small style="font-size:14px;font-weight:800;color:var(--muted)">/100</small></span></div>
  </div>`;
  return `<section id="s-facts" class="card fact-card anim-enter" aria-label="핵심 지표 요약" style="--enter-delay:0.03s">
    <h2>① 숫자 요약 (팩트 매트릭스)</h2>
    ${renderSampleBadge(data)}
    ${strip}
    <p class="fact-hint">외부 AI나 서버 없이, <strong>보낸 CSV 안의 숫자만</strong>으로 만든 표예요. 지니 계수·리듬 점수는 표본(메시지·참여자) 기준 <strong>상대 비교</strong>용이며, 아래 ③에서 분포·쏠림을 함께 보세요.</p>
    <div class="fact-grid">${inner}</div>
  </section>`;
}

function renderInsightDeck(data: ReportData): string {
  const ins = data.insights;
  const giniStr = ins.participantGini === null ? "—" : String(ins.participantGini);
  const p90 = formatReplyGapMinutes(ins.replyGapP90Minutes);
  const silence = ins.maxSilenceBetweenActiveDays === null ? "—" : `${ins.maxSilenceBetweenActiveDays}일`;
  const entropy = ins.linkDomainEntropyBits === null ? "—" : `${ins.linkDomainEntropyBits} bit`;
  const density = ins.densityMessagesPerCalendarDay === null ? "—" : String(ins.densityMessagesPerCalendarDay);
  const daypartBar = ins.daypartPercents
    .map((d) => {
      const w = Math.max(0, d.percent);
      const c = daypartColor(d.key);
      return `<span class="dp-seg" style="width:${w}%;background:${c}" title="${escapeHtml(d.label)} ${w}%"></span>`;
    })
    .join("");
  const scatter = renderParticipantScatter(data.participants);
  const pace = data.conversationPace;
  const richness =
    ins.lexicalTypeRichnessPercent === null ? "—" : `${ins.lexicalTypeRichnessPercent}%`;
  return `<section id="s-ai" class="card insight-hero anim-enter" style="margin-bottom:14px;--enter-delay:0.05s">
    <div class="pace-ribbon" role="note">
      <strong>${escapeHtml(pace.emoji)} ${escapeHtml(pace.label)}</strong>
      <span>${escapeHtml(pace.detail)}</span>
    </div>
    ${renderActivityArcStrip(data.activityArc)}
    <div class="insight-head">
      <div>
        <h2>③ 분위기·리듬 (고급 인사이트)</h2>
        <p class="insight-lede">참여가 고르지 않은지, 응답이 한번에 몰리는지, 링크가 여러 사이트로 퍼지는지 같은 <strong>패턴 지표</strong>예요. 낯선 말은 맨 아래 <a href="#s-help" data-kca-jump="s-help" style="color:var(--accent);font-weight:750">⑥ 용어 설명</a>을 펼쳐 보세요.</p>
      </div>
      <div class="rh-wrap anim-ring" aria-label="리듬 점수">
        <div class="rh-ring" style="--p:${ins.rhythmScore}"><span></span></div>
        <div class="rh-cap"><strong>리듬</strong><span>${ins.rhythmScore}<small>/100</small></span></div>
      </div>
    </div>
    <div class="insight-grid">
      ${insMetric("주말 비중", `${ins.weekendSharePercent}%`, "토·일 메시지 비율")}
      ${insMetric("참여 지니", giniStr, giniMetricSub(ins.participantGini, data.summary.participants))}
      ${insMetric("응답 상위10%", p90, "느린 쪽 10% 구간")}
      ${insMetric("최장 공백", silence, "활동일 사이 최대 휴지")}
      ${insMetric("상위3 점유", `${ins.top3ParticipantSharePercent}%`, top3MetricSub(ins.top3ParticipantSharePercent, ins.participantGini))}
      ${insMetric("링크 다양성", entropy, "공유 사이트 종류(bit)")}
      ${insMetric("캘린더 밀도", density, "달력 하루당 평균 메시지")}
      ${insMetric("질문 느낌", `${ins.questionLikeMessagesPer100}/100`, "물음표 포함 비슷한 톤")}
      ${insMetric("화자 전환", `${ins.speakerSwitchRatePer100}/100`, "100메시지당 말바꿈")}
      ${insMetric("어휘 분산", richness, "서로 다른 키워드 비중")}
    </div>
    <div class="insight-split">
      <div>
        <h3 class="insight-sub">하루 시간대 비중</h3>
        <p class="chart-hint">새벽·아침·낮·저녁 네 덩어리로 나눈 <strong>메시지 비율</strong>이에요.</p>
        <div class="daypart-bar" role="img" aria-label="시간대 비중">${daypartBar}</div>
        <ul class="daypart-legend">${ins.daypartPercents
          .map(
            (d) =>
              `<li><i style="background:${daypartColor(d.key)}"></i>${escapeHtml(d.label)} <strong>${d.percent}%</strong></li>`,
          )
          .join("")}</ul>
      </div>
      <div>
        <h3 class="insight-sub">참여자 말풍선 맵</h3>
        <p class="chart-hint">말풍선 <strong>크기·위치</strong>로 비중(가로)과 평균 글자 수(세로)를 봅니다. 좁은 화면에서는 채팅 목록형으로 펼쳐져요.</p>
        ${scatter}
      </div>
    </div>
  </section>`;
}

function renderSampleBadge(data: ReportData): string {
  const s = data.summary;
  const range =
    s.firstMessage && s.lastMessage
      ? `${s.firstMessage.slice(0, 10)} ~ ${s.lastMessage.slice(0, 10)}`
      : "기간 미상";
  return `<p class="stat-sample-badge" role="note"><span class="stat-sample-k">표본</span> <strong>${escapeHtml(formatNumber(s.totalMessages))}</strong>건 · <strong>${escapeHtml(formatNumber(s.participants))}</strong>명 · 활동 <strong>${escapeHtml(formatNumber(s.activeDays))}</strong>일 <span class="stat-sample-range">${escapeHtml(range)}</span></p>`;
}

function giniMetricSub(gini: number | null, participants: number): string {
  if (gini === null) return `표본 n=${participants}명 — 지니 산출 불가`;
  const band =
    gini < 0.42 ? "고른 참여(상대)" : gini < 0.62 ? "중간 쏠림" : "소수 집중(상대)";
  return `${band} · n=${participants}`;
}

function top3MetricSub(top3: number, gini: number | null): string {
  const skew =
    top3 >= 70 ? "상위 3명이 대부분" : top3 >= 50 ? "상위가 절반 이상" : "비중 분산";
  const tail = gini !== null && gini >= 0.65 ? " · 지니도 높음" : "";
  return `${skew}${tail}`;
}

function insMetric(label: string, value: string, sub: string): string {
  return `<div class="ins-metric"><span class="ins-m-label">${escapeHtml(label)}</span><span class="ins-m-val">${escapeHtml(value)}</span><span class="ins-m-sub">${escapeHtml(sub)}</span></div>`;
}

function daypartColor(key: string): string {
  switch (key) {
    case "dawn":
      return "linear-gradient(180deg,#818cf8,#4f46e5)";
    case "morning":
      return "linear-gradient(180deg,#22d3ee,#0891b2)";
    case "afternoon":
      return "linear-gradient(180deg,#4ade80,#059669)";
    case "evening":
      return "linear-gradient(180deg,#fb923c,#ea580c)";
    default:
      return "#64748b";
  }
}

function renderParticipantScatter(parts: ParticipantStat[]): string {
  const top = parts.slice(0, 12);
  if (top.length === 0) {
    return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
  }
  const maxShare = Math.max(...top.map((p) => p.sharePercent), 0.1);
  const maxLen = Math.max(...top.map((p) => p.averageLength), 1);
  const minLen = Math.min(...top.map((p) => p.averageLength));
  const lenSpan = Math.max(maxLen - minLen, 0.1);
  return renderParticipantBubbleMap(top, maxShare, minLen, lenSpan);
}

function renderParticipantBubbleMap(
  top: ParticipantStat[],
  maxShare: number,
  minLen: number,
  lenSpan: number,
): string {
  const maxMessages = Math.max(...top.map((p) => p.messages), 1);
  const layouts = resolveBubbleOverlaps(
    top.map((p) => {
      const x = 14 + (p.sharePercent / maxShare) * 72;
      const yRaw = (p.averageLength - minLen) / lenSpan;
      const y = 16 + (1 - yRaw) * 68;
      return { x, y, scale: scatterScale(p.messages, maxMessages) };
    }),
  );
  const bubbles = top
    .map((p, i) => {
      const { x, y, scale } = layouts[i]!;
      const hue = (i * 53) % 360;
      const title = `${p.alias} · ${p.sharePercent}% · 평균 ${p.averageLength}자 · ${formatNumber(p.messages)}건`;
      return `<div class="bubble-node" style="left:${x}%;top:${y}%;--bubble-scale:${scale};--bubble-hue:${hue}" title="${escapeHtml(title)}">
        <span class="bubble-shape" aria-hidden="true"></span>
        <div class="bubble-content">
          <strong>${escapeHtml(p.alias)}</strong>
          <span class="bubble-pct">${p.sharePercent}%</span>
          <small>평균 ${p.averageLength}자 · ${formatNumber(p.messages)}건</small>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="sc-plot" role="img" aria-label="참여자 말풍선 맵: 가로 메시지 비중, 세로 평균 글자 수">
    <span class="sc-grid-label sc-lbl-top">평균 글자 ↑</span>
    <span class="sc-grid-label sc-lbl-bottom">평균 글자 ↓</span>
    <span class="sc-grid-label sc-lbl-left">비중 ↓</span>
    <span class="sc-grid-label sc-lbl-right">비중 ↑</span>
    <span class="sc-quadrant sc-q-tl">길게 · 적게</span>
    <span class="sc-quadrant sc-q-tr">길게 · 많이</span>
    <span class="sc-quadrant sc-q-bl">짧게 · 적게</span>
    <span class="sc-quadrant sc-q-br">짧게 · 많이</span>
    <div class="sc-plot-list">${bubbles}</div>
  </div>`;
}

function scatterScale(messages: number, maxMessages: number): number {
  return Math.round((0.72 + (messages / maxMessages) * 0.45) * 100) / 100;
}

function privacyLabel(mode: string): string {
  if (mode === "public-masked") return "부분 마스킹(기본)";
  if (mode === "public-anonymous") return "완전 별칭(User 001)";
  return mode;
}

function panel(title: string, hint: string, content: string): string {
  return `<div class="card"><h2>${escapeHtml(title)}</h2><p class="chart-hint" style="margin-top:-4px">${escapeHtml(hint)}</p>${content}</div>`;
}

function renderSelfServeCallout(): string {
  const gh = "https://github.com/claudianus/kakaotalk-chat-analyzer";
  const site = "https://claudianus.github.io/kakaotalk-chat-analyzer/";
  const npmShort = "https://www.npmjs.com/package/kcachat";
  const npmFull = "https://www.npmjs.com/package/kakaotalk-chat-analyzer";
  return `<section class="card self-serve" aria-label="리포트 직접 만들기">
    <h2>비슷한 리포트, 다른 대화에도 만들어보기</h2>
    <p>이 페이지는 <strong>KakaoTalk Chat Analyzer</strong>(CLI 이름 <strong>kca</strong>)로 만든 <strong>집계 전용</strong> 리포트예요. 카카오톡에서 CSV로 보낸 뒤 같은 방식으로 돌려볼 수 있습니다.</p>
    <ol>
      <li>카카오톡에서 채팅방 → <strong>더보기(≡)</strong> → <strong>대화보내기</strong> → <strong>CSV 보내기</strong>로 파일 저장</li>
      <li><strong>Node.js 22+</strong>가 있는 Mac/Windows/Linux에서 터미널을 열고, 보낸 파일 경로를 넣어 실행해 보세요.</li>
    </ol>
    <div class="cmd">npx kcachat@latest "./KakaoTalk_Chat_보낸파일.csv"</div>
    <p>기본은 리포트를 만든 뒤 <strong>BrewPage에 자동 업로드</strong>해 공유 링크를 출력합니다. PC에만 저장하려면 <code>--local</code> 을 붙이세요(업로드 생략, <code>index.html</code> 만 생성).</p>
    <p>짧은 이름이 부담스럽다면: <code>npx kakaotalk-chat-analyzer@latest "./파일.csv"</code> · 로컬만: <code>… --local</code></p>
    <p class="links">
      ${externalLink(gh, "GitHub 소스")}
      · ${externalLink(npmShort, "npm · kcachat")}
      · ${externalLink(npmFull, "npm · kakaotalk-chat-analyzer")}
      · ${externalLink(site, "소개 페이지")}
    </p>
  </section>`;
}

function renderDaily(days: DailyCount[], burstDays: DailyCount[] = []): string {
  if (days.length === 0) return `<p style="margin:0;color:var(--muted);font-size:13px">날짜가 있는 메시지가 없습니다.</p>`;
  const max = Math.max(...days.map((day) => day.count), 1);
  const burstSet = new Set(burstDays.map((d) => d.date));
  const cells = days
    .map((day) => {
      const ratio = day.count / max;
      const alpha = Math.min(0.92, Math.max(0.1, 0.1 + ratio * 0.82));
      const bg = `rgba(15, 107, 92, ${alpha.toFixed(2)})`;
      const fg = ratio > 0.42 ? "#f4f8f7" : "#0c2a24";
      const short = formatDayMd(day.date);
      const burst = burstSet.has(day.date);
      const burstCls = burst ? " day-burst" : "";
      const burstMark = burst ? " 🔥" : "";
      return `<div class="day${burstCls}" title="${escapeHtml(day.date)} · ${day.count}건${burst ? " · 급증일" : ""}" style="background-color:${bg};color:${fg}"><span class="day-k">${escapeHtml(short)}${burstMark}</span><span class="day-n">${day.count}</span></div>`;
    })
    .join("");
  return `<div class="calendar-wrap">
    <p class="chart-hint">날짜 순으로 칸이 채워져요. <strong>월/일</strong>(위) · <strong>메시지 수</strong>(아래). 테두리·🔥는 급증일입니다.</p>
    <div class="calendar">${cells}</div>
  </div>`;
}

function renderActivityArcStrip(arc: ActivityArcSegment[]): string {
  if (arc.length <= 1) return "";
  return `<div class="arc-strip" aria-label="기간별 메시지 비교">${arc
    .map(
      (a) =>
        `<div class="arc-chip"><small>${escapeHtml(a.label)}</small><b>${formatNumber(a.messages)}</b><small>${a.activeDays}일 활동</small></div>`,
    )
    .join("")}</div>`;
}

function renderMonthly(months: DailyCount[]): string {
  if (months.length === 0) return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
  return renderCountBars(months.map((m) => ({ label: m.date, count: m.count })));
}

function renderHoursBand(hours: number[], start: number, bandClass: string, bandLabel: string): string {
  const slice = hours.slice(start, start + 12);
  const max = Math.max(...hours, 1);
  const bars = slice
    .map((count, i) => {
      const hour = start + i;
      const height = Math.max(2, Math.round((count / max) * 100));
      const tone = bandClass === "hours-band-am" ? "hour-am" : "hour-pm";
      return `<div class="hour ${tone}" title="${hour}시 · ${formatNumber(count)}건" style="height:${height}%"></div>`;
    })
    .join("");
  const labels = slice.map((_, i) => `<span title="${start + i}시">${start + i}</span>`).join("");
  return `<div class="hours-half"><div class="hours-band ${bandClass}">${bandLabel}</div><div class="hours-bars">${bars}</div><div class="hours-labels">${labels}</div></div>`;
}

function renderHours(hours: number[]): string {
  return `<div class="hours-wrap">
    <div class="hours-split">
      ${renderHoursBand(hours, 0, "hours-band-am", "오전 · 0–11시")}
      ${renderHoursBand(hours, 12, "hours-band-pm", "오후 · 12–23시")}
    </div>
  </div>`;
}

/** YYYY-MM-DD → M/D (앞자리 0 제거) */
function formatDayMd(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  return `${Number(m[2])}/${Number(m[3])}`;
}

function renderParticipants(participants: ParticipantStat[]): string {
  if (participants.length === 0) {
    return `<p style="margin:0;color:var(--muted);font-size:13px">참여자 데이터가 없습니다.</p>`;
  }
  return `<table class="table table-rank"><thead><tr><th>표시명</th><th class="num">메시지</th><th class="num">비율</th><th class="num">평균 길이</th><th class="num">URL</th><th class="num">첨부</th><th class="num">심야</th><th class="num">연속 최대</th></tr></thead><tbody>${participants
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.alias)}</td><td class="num">${formatNumber(p.messages)}</td><td class="num">${p.sharePercent}%</td><td class="num">${p.averageLength}</td><td class="num">${formatNumber(p.linkMessages)}</td><td class="num">${formatNumber(p.attachmentMessages)}</td><td class="num">${formatNumber(p.nightMessages)}</td><td class="num">${formatNumber(p.maxConsecutive)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}


function renderRoomEvents(
  stats: RoomEventStats,
  totalMessages: number,
  pulse: DailyRoomPulse[] = [],
): string {
  if (stats.total === 0) {
    return '<p style="margin:0;color:var(--muted);font-size:13px">시스템·운영 알림이 없거나, 보내기 형식에서 감지되지 않았습니다.</p>';
  }
  const pairs: [keyof RoomEventStats, string][] = [
    ["joinCount", SYSTEM_NOTICE_LABELS.join],
    ["leaveCount", SYSTEM_NOTICE_LABELS.leave],
    ["deletedCount", SYSTEM_NOTICE_LABELS.deleted],
    ["hiddenCount", SYSTEM_NOTICE_LABELS.hidden],
    ["kickCount", SYSTEM_NOTICE_LABELS.kick],
    ["slowModeOnCount", SYSTEM_NOTICE_LABELS.slowModeOn],
    ["slowModeOffCount", SYSTEM_NOTICE_LABELS.slowModeOff],
    ["subManagerCount", SYSTEM_NOTICE_LABELS.subManager],
    ["managerCount", SYSTEM_NOTICE_LABELS.manager],
    ["shopSearchCount", SYSTEM_NOTICE_LABELS.shopSearch],
    ["photoBundleCount", SYSTEM_NOTICE_LABELS.photoBundle],
  ];
  const items: CountItem[] = pairs
    .map(([key, label]) => ({ label, count: stats[key] as number }))
    .filter((item) => item.count > 0);
  const ofAll =
    totalMessages > 0
      ? `<p class="kw-note" style="margin-top:10px">전체 <strong>${formatNumber(totalMessages)}</strong>건 중 시스템·운영 알림 합계 <strong>${stats.total}</strong>건 (입장 ${stats.joinSharePercent}% · 퇴장 ${stats.leaveSharePercent}% · 가림 ${stats.hiddenSharePercent}% · 강퇴 ${stats.kickSharePercent}%).</p>`
      : "";
  return renderCountBars(items) + renderRoomPulseMini(pulse) + ofAll;
}

function renderRoomPulseMini(pulse: DailyRoomPulse[]): string {
  const active = pulse.filter((p) => p.join + p.leave + p.hidden + p.kick > 0);
  if (active.length === 0) return "";
  const max = Math.max(...active.map((p) => p.join + p.leave + p.hidden + p.kick), 1);
  const bars = active
    .map((p) => {
      const sum = p.join + p.leave + p.hidden + p.kick;
      const h = Math.max(8, Math.round((sum / max) * 100));
      const title = `${p.date} 입장 ${p.join} · 퇴장 ${p.leave} · 가림 ${p.hidden} · 강퇴 ${p.kick}`;
      return `<div class="pulse-bar" style="height:${h}%" title="${escapeHtml(title)}"></div>`;
    })
    .join("");
  return `<div class="pulse-mini"><h4>일별 운영·유입 펄스 (입·퇴·가림·강퇴 합)</h4><div class="pulse-row" role="img" aria-label="일별 시스템 알림 강도">${bars}</div></div>`;
}

function renderReactionsPanel(data: ReportData): string {
  const parts: string[] = [];
  const total = data.summary.totalMessages;
  if (data.pureLaughMessages > 0) {
    const pct = total > 0 ? Math.round((data.pureLaughMessages / total) * 1000) / 10 : 0;
    parts.push(
      `<p style="margin:0 0 8px"><strong>ㅋㅋ·ㅎㅎ만</strong> · ${formatNumber(data.pureLaughMessages)}건 (${pct}%)</p>`,
    );
  }
  if (data.story.tone.laughPer100 > 0) {
    parts.push(`<p style="margin:0 0 8px">웃음 패턴 포함 · 100건당 ${data.story.tone.laughPer100}건</p>`);
  }
  if (data.repeatedPhrases.length > 0) {
    parts.push(renderCountBars(data.repeatedPhrases.map((r) => ({ label: r.label, count: r.count }))));
  } else if (parts.length === 0) {
    return '<p style="margin:0;color:var(--muted);font-size:13px">반복 문구·순수 ㅋㅋ 리액션이 거의 없습니다.</p>';
  }
  return parts.join("");
}

function renderTopicMap(data: ReportData): string {
  const displayTopics = topicsForDisplay(data.topics, data.daily);
  if (displayTopics.length === 0) return "";
  const shortSpan = displayTopics.length < data.topics.length;
  const themes = displayTopics.filter((t) => t.kind === "theme");
  const periods = displayTopics.filter((t) => t.kind === "period");
  const renderCards = (items: typeof displayTopics) =>
    items
    .map((t) => {
      const kind =
        t.kind === "period"
          ? `<span class="topic-badge period">${escapeHtml(t.periodLabel ?? "기간")}</span>`
          : `<span class="topic-badge theme">주제</span>`;
      const chips = t.terms
        .map((term) => `<span class="topic-chip">${escapeHtml(term)}</span>`)
        .join("");
      const sizeClass =
        t.messagePercent >= 18 ? " topic-card--lg" : t.messagePercent >= 8 ? " topic-card--md" : "";
      return `<article class="topic-card${sizeClass}">
        <header>${kind}<strong>${escapeHtml(t.title)}</strong><span class="topic-pct">~${t.messagePercent}%</span></header>
        <div class="topic-chips">${chips}</div>
      </article>`;
    })
    .join("");
  const periodBlock =
    periods.length > 0
      ? `<div class="topic-group"><h3 class="topic-group-title">월별 화제</h3><div class="topic-grid topic-grid--periods">${renderCards(periods)}</div></div>`
      : "";
  const themeBlock =
    themes.length > 0
      ? `<div class="topic-group"><h3 class="topic-group-title">의미 테마</h3><div class="topic-grid topic-grid--themes">${renderCards(themes)}</div></div>`
      : "";
  const hint = shortSpan
    ? "짧은 기간 보내기는 <strong>월 메시지 비중</strong>이 주제처럼 보일 수 있어, 월별 카드는 숨기고 「기간 비교」를 봐 주세요."
    : "공기 그래프 군집·월별 <strong>c-TF-IDF</strong>로 뽑았어요. 비율은 해당 신호가 잡힌 메시지 근사치입니다.";
  return `<section id="s-topics" class="card anim-enter" style="margin-bottom:14px;--enter-delay:0.052s">
    <h2>이 방의 주제 맵</h2>
    <p class="chart-hint">${hint}</p>
    ${themeBlock}
    ${periodBlock}
  </section>`;
}

function renderShopSearchSection(data: ReportData): string {
  const topics = data.shopSearchTopics;
  const noticeCount = data.roomEvents.shopSearchCount;
  if (topics.length === 0 && noticeCount === 0) return "";
  if (topics.length === 0) {
    return `<section style="margin-bottom:14px">${panel(
      "샵검색 키워드",
      `시스템 알림 <strong>${formatNumber(noticeCount)}</strong>건이 있으나, <code>샵검색:</code> 형식에서 #주제를 추출하지 못했습니다. 보내기 형식이 바뀌었을 수 있습니다.`,
      '<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>',
    )}</section>`;
  }
  const tagSum = topics.reduce((s, t) => s + t.count, 0);
  const footnote =
    noticeCount > tagSum
      ? `<p class="chart-hint" style="margin:10px 0 0">시스템 알림 <strong>${formatNumber(noticeCount)}</strong>건 중 태그 추출 <strong>${formatNumber(tagSum)}</strong>건입니다.</p>`
      : "";
  return `<section style="margin-bottom:14px">${panel(
    "샵검색 키워드",
    "카카오톡 샵검색으로 공유된 #주제입니다.",
    renderCountBars(topics) + footnote,
  )}</section>`;
}

function renderKeywordCssFold(data: ReportData): string {
  const body = renderKeywordSnapshot(data.keywords, data);
  return `<details class="kw-css-fold" open>
    <summary>키워드 상위 12개 요약<small>전체 순위·막대는 「④ 인터랙티브 차트」</small></summary>
    <div class="kw-css-body">
      <p class="chart-hint" style="margin:0 0 10px">숫자는 메시지 등장 횟수입니다.</p>
      ${body}
    </div>
  </details>`;
}

function renderKeywordSnapshot(items: CountItem[], data: ReportData): string {
  const sem =
    data.summary.usedSemanticKeywords === true
      ? " 한국어·다국어 <strong>임베딩</strong> 시맨틱 클러스터를 보조 반영했습니다."
      : "";
  const note =
    `<p class="kw-note"><strong>Kiwi</strong> 한국어 형태소·<strong>BM25</strong>로 본문 명사·구를 뽑고, 해시태그·방별 사전·슬랭을 보조로 더합니다.${sem} 막대·표의 숫자는 <strong>해당 표현이 들어간 메시지 수</strong>예요. 위 <a href="#s-viz" data-kca-jump="s-viz">인터랙티브 차트</a>에서 워드클라우드·전체 표를 볼 수 있어요.</p>`;
  if (items.length === 0) {
    return note + '<p style="margin:0;color:var(--muted);font-size:13px">추출된 키워드가 없습니다.</p>';
  }
  return note + renderCountBars(items.slice(0, 12));
}

function renderCountBars(items: CountItem[]): string {
  if (items.length === 0) return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
  const max = Math.max(...items.map((item) => item.count), 1);
  return `<div class="bars">${items
    .map((item) => {
      const width = Math.max(2, Math.round((item.count / max) * 100));
      return `<div class="bar-row"><span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span><span class="bar-value">${formatNumber(item.count)}</span></div>`;
    })
    .join("")}</div>`;
}

function renderProvenanceSideCard(data: ReportData): string {
  if (!data.provenance) return "";
  return `<p><strong>생성 도구</strong><br>${escapeHtml(formatGeneratorLine(data.provenance))}</p>`;
}

function renderProvenanceDetailsBlock(data: ReportData): string {
  if (!data.provenance) return "";
  const lines = formatProvenanceDetails(data.provenance);
  return `<details class="kca-provenance">
      <summary>리포트 정보</summary>
      <ul class="kca-provenance-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </details>`;
}

function renderProvenanceFooterPrefix(data: ReportData): string {
  if (!data.provenance) return "";
  return `${escapeHtml(formatGeneratorLine(data.provenance))} · `;
}

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatBuildTiming(t: NonNullable<ReportData["buildTiming"]>): string {
  const total = formatDurationMs(t.totalMs);
  const agg = formatDurationMs(t.parseAggregateMs);
  const html = formatDurationMs(t.renderHtmlMs);
  const write = formatDurationMs(t.writeFileMs);
  return `${total} (집계 ${agg} · HTML ${html} · 저장 ${write})`;
}

function formatBuildTimingShort(t: NonNullable<ReportData["buildTiming"]>): string {
  return formatDurationMs(t.totalMs);
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  return sec < 10 ? `${sec.toFixed(1)}초` : `${Math.round(sec)}초`;
}

function externalLink(href: string, label: string): string {
  return `<a href="#" role="link" data-kca-external data-kca-external-url="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}
