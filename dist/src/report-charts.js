import { isShortActivitySpan, topicsThemesOnly } from "./report-chart-util.js";
import { escapeHtml, formatNumber } from "./report-util.js";
/** @deprecated preconnect는 report-head.ts REPORT_HEAD_LINKS 사용 */
export const CHART_CDN_HEAD = ``;
/** body 끝: 차트 라이브러리 — defer 금지(인라인 init보다 반드시 먼저 실행) */
export const CHART_CDN_BODY = `
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js"></script>
`;
export function serializeChartPayload(data) {
    return JSON.stringify(buildChartPayload(data))
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
export function buildChartPayload(data) {
    return {
        hourly: data.hourly,
        weekdays: data.weekdays,
        monthly: data.monthly.map((m) => ({ label: m.date, count: m.count })),
        daily: data.daily,
        keywords: data.keywords,
        domains: data.domains.slice(0, 24),
        participants: data.participants.slice(0, 24).map((p) => ({
            alias: p.alias,
            messages: p.messages,
            sharePercent: p.sharePercent,
        })),
        calendarCells: data.story.calendarWeeks
            .flatMap((w) => w.cells)
            .filter((c) => c.date && c.count > 0)
            .map((c) => ({ date: c.date, count: c.count })),
        burstDates: data.burstDays.map((b) => b.date),
        totalParticipants: data.participants.length,
        topicsThemes: topicsThemesOnly(data.topics)
            .slice(0, 8)
            .map((t) => ({ title: t.title, terms: t.terms, messagePercent: t.messagePercent })),
        topicsPeriods: isShortActivitySpan(data.daily)
            ? []
            : data.topics
                .filter((t) => t.kind === "period")
                .slice(0, 4)
                .map((t) => ({
                title: t.title,
                terms: t.terms,
                messagePercent: t.messagePercent,
                periodLabel: t.periodLabel,
            })),
        interaction: data.interaction
            ? {
                aliases: data.interaction.aliases,
                matrix: data.interaction.matrix,
                totalReplies: data.interaction.totalReplies,
            }
            : null,
    };
}
export function serializeExplorerPayload(data) {
    return JSON.stringify(data.explorer)
        .replace(/</g, "\\u003c")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
export function renderChartDeck(data) {
    const kw = data.keywords.length;
    const themeCount = topicsThemesOnly(data.topics).length;
    const showLegacyDaily = data.story.calendarWeeks.length === 0 && data.daily.length > 0;
    const topicChart = themeCount > 0
        ? `<article class="viz-card span-12">
      <h3>대화 테마 · c-TF-IDF</h3>
      <p class="viz-hint">막대 = <strong>의미 주제</strong> 신호 비중(근사 %). 월별 메시지량은 「기간 비교」·아래 주제 카드의 월별 화제를 보세요.</p>
      <div id="chart-topics" class="chart-box" role="img" aria-label="주제 테마 차트"></div>
    </article>`
        : "";
    return `<section id="s-viz" class="viz-hero anim-enter" style="--enter-delay:0.055s" aria-label="인터랙티브 차트">
    <h2>📊 인터랙티브 차트</h2>
    <p>ECharts 기반 — 막대·히트맵·워드클라우드에 마우스를 올리면 수치를 확인할 수 있어요. 키워드 <strong>${formatNumber(kw)}</strong>개(메시지 등장 횟수 기준).</p>
  </section>
  <div class="viz-grid anim-enter" style="--enter-delay:0.06s">
    <article class="viz-card span-8">
      <h3>키워드 워드클라우드</h3>
      <p class="viz-hint">글자 크기 = 메시지 등장 빈도. Kiwi·BM25로 뽑은 본문 키워드입니다.</p>
      <div id="chart-kw-cloud" class="chart-box tall" role="img" aria-label="키워드 워드클라우드"></div>
    </article>
    <article class="viz-card span-4">
      <h3>시간대 분포</h3>
      <p class="viz-hint">0~23시 메시지량</p>
      <div id="chart-hours" class="chart-box compact" role="img" aria-label="시간대 차트"></div>
    </article>
    <article class="viz-card span-6">
      <h3>일별 활동 히트맵</h3>
      <p class="viz-hint">활동 기간만 표시 · 급증일 강조</p>
      <div id="chart-daily-heat" class="chart-box" role="img" aria-label="일별 히트맵"></div>
    </article>
    <article class="viz-card span-6">
      <h3>요일 분포</h3>
      <p class="viz-hint">요일별 메시지량</p>
      <div id="chart-weekday" class="chart-box compact" role="img" aria-label="요일 차트"></div>
      <h3 style="margin-top:14px">월별 추이</h3>
      <p class="viz-hint">월 단위 합계</p>
      <div id="chart-monthly" class="chart-box compact" role="img" aria-label="월별 차트"></div>
    </article>
    <article class="viz-card span-12">
      <h3>키워드 순위 · 메시지 등장 횟수</h3>
      <p class="viz-hint">막대 길이 = 1위 대비 비율 · 전체 ${formatNumber(kw)}개 · 워드클라우드는 위 카드</p>
      ${renderKeywordRankedList(data.keywords)}
    </article>
    <article class="viz-card span-6">
      <h3>참여자 상위</h3>
      <p class="viz-hint">전체 ${formatNumber(data.participants.length)}명 · 도넛 상위 10명 + 기타</p>
      <div id="chart-participants" class="chart-box" role="img" aria-label="참여자 차트"></div>
      ${renderParticipantLegend(data.participants)}
    </article>
    <article class="viz-card span-6">
      <h3>공유 도메인</h3>
      <p class="viz-hint">링크 호스트 상위</p>
      <div id="chart-domains" class="chart-box" role="img" aria-label="도메인 차트"></div>
    </article>
    ${topicChart}
  </div>
  ${showLegacyDaily ? "" : "<!-- legacy daily heatmap omitted when story calendar exists -->"}`;
}
function renderParticipantLegend(participants) {
    if (participants.length === 0)
        return "";
    const rows = participants
        .slice(0, 12)
        .map((p) => `<li><span class="pie-legend-name" title="${escapeHtml(p.alias)}">${escapeHtml(p.alias)}</span><span class="pie-legend-pct">${formatNumber(p.messages)} · ${p.sharePercent}%</span></li>`)
        .join("");
    return `<ul class="pie-legend" aria-label="참여자 범례">${rows}</ul>`;
}
function kwBarFillClass(rankIndex) {
    if (rankIndex === 0)
        return "kw-bar-fill kw-bar-fill--rank1";
    if (rankIndex === 1)
        return "kw-bar-fill kw-bar-fill--rank2";
    if (rankIndex === 2)
        return "kw-bar-fill kw-bar-fill--rank3";
    return "kw-bar-fill";
}
function renderKeywordRankedList(items) {
    if (items.length === 0)
        return "";
    const max = Math.max(items[0]?.count ?? 0, 1);
    const rows = items
        .map((item, i) => {
        const width = Math.max(2, Math.round((item.count / max) * 100));
        const fillClass = kwBarFillClass(i);
        return `<tr>
        <td class="kw-rank num">${i + 1}</td>
        <td class="kw-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</td>
        <td class="kw-bar-cell">
          <div class="kw-bar-track" role="meter" aria-valuenow="${item.count}" aria-valuemin="0" aria-valuemax="${max}" aria-label="${escapeHtml(item.label)} 메시지 ${formatNumber(item.count)}건">
            <span class="${fillClass}" style="width:${width}%"></span>
          </div>
        </td>
        <td class="num">${formatNumber(item.count)}</td>
      </tr>`;
    })
        .join("");
    return `<div class="kw-table-wrap"><table class="kw-table kw-table--ranked"><colgroup><col class="kw-col-rank" /><col class="kw-col-label" /><col class="kw-col-bar" /><col class="kw-col-count" /></colgroup><thead><tr><th>#</th><th>키워드</th><th>비율</th><th class="num">메시지 수</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
export const CHARTS_INIT_SCRIPT = `
    (function () {
      function run() {
      var dataEl = document.getElementById("kca-chart-data");
      if (!dataEl) return;
      if (typeof echarts === "undefined") return;
      var data;
      try { data = JSON.parse(dataEl.textContent || "{}"); } catch (e) { return; }

      var dark = document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.getAttribute("data-theme") &&
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      var text = dark ? "#e9eef5" : "#141a1f";
      var muted = dark ? "#8b98a8" : "#5c6670";
      var accent = dark ? "#3ee8c5" : "#0f6b5c";
      var accent2 = dark ? "#818cf8" : "#4f46e5";
      function cssVar(name, fallback) {
        try {
          var v = getComputedStyle(document.body).getPropertyValue(name).trim();
          return v || fallback;
        } catch (e) { return fallback; }
      }
      var heatLo = cssVar("--chart-heat-lo", dark ? "#1a2744" : "#d4e4f4");
      var heatHi = cssVar("--chart-heat-hi", dark ? "#5ee8ff" : "#1e4fd6");
      var wdColors = [
        cssVar("--chart-wd-0", dark ? "#818cf8" : "#4f46e5"),
        cssVar("--chart-wd-1", dark ? "#3ee8c5" : "#0f6b5c"),
        cssVar("--chart-wd-2", dark ? "#34d399" : "#059669"),
        cssVar("--chart-wd-3", dark ? "#2dd4bf" : "#0d9488"),
        cssVar("--chart-wd-4", dark ? "#38bdf8" : "#0284c7"),
        cssVar("--chart-wd-5", dark ? "#fbbf24" : "#d97706"),
        cssVar("--chart-wd-6", dark ? "#fb923c" : "#ea580c"),
      ];

      function baseOpt() {
        return {
          textStyle: { color: text, fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif" },
          tooltip: { trigger: "axis", backgroundColor: dark ? "#1c2128" : "#fff", borderColor: "transparent" },
        };
      }

      var charts = [];
      function resizeAll() {
        charts.forEach(function (c) {
          try { c.resize(); } catch (e) {}
        });
      }
      function layout(el) {
        var w = (el && el.clientWidth) || 400;
        if (w < 380) {
          return { w: w, left: 28, right: 8, top: 14, bottom: 44, fs: 9, rot: 40, leftCat: 56, bottomRot: 42 };
        }
        if (w < 640) {
          return { w: w, left: 40, right: 10, top: 18, bottom: 34, fs: 10, rot: 26, leftCat: 72, bottomRot: 32 };
        }
        return { w: w, left: 48, right: 14, top: 22, bottom: 28, fs: 11, rot: 0, leftCat: 96, bottomRot: 28 };
      }
      function init(id, opt) {
        var el = document.getElementById(id);
        if (!el) return null;
        try {
          var chart = echarts.init(el, null, { renderer: "canvas" });
          chart.setOption(opt);
          charts.push(chart);
          if (typeof ResizeObserver !== "undefined") {
            var ro = new ResizeObserver(function () {
              requestAnimationFrame(function () {
                try { chart.resize(); } catch (e) {}
              });
            });
            ro.observe(el);
          }
          return chart;
        } catch (err) {
          console.error("[kca-chart]", id, err);
          el.setAttribute("data-chart-failed", "1");
          el.innerHTML = '<p style="margin:0;padding:12px;font-size:12px;color:var(--muted);text-align:center">차트를 불러오지 못했어요. 새로고침하거나 네트워크(CDN)를 확인해 주세요.</p>';
          return null;
        }
      }
      var mqWide = window.matchMedia && window.matchMedia("(min-width: 900px)");
      if (mqWide && mqWide.addEventListener) {
        mqWide.addEventListener("change", function () { setTimeout(resizeAll, 80); });
      } else if (mqWide && mqWide.addListener) {
        mqWide.addListener(function () { setTimeout(resizeAll, 80); });
      }
      var themeObs = new MutationObserver(function () { setTimeout(resizeAll, 60); });
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      function hourBarColor(h) {
        if (h <= 5) return dark ? "#6366f1" : "#4f46e5";
        if (h <= 11) return dark ? "#3ee8c5" : "#0f6b5c";
        if (h <= 17) return dark ? "#fbbf24" : "#d97706";
        return dark ? "#3b82f6" : "#1d4ed8";
      }
      if (data.hourly && document.getElementById("chart-hours")) {
        var hoursEl = document.getElementById("chart-hours");
        var hg = layout(hoursEl);
        init("chart-hours", Object.assign(baseOpt(), {
          grid: { left: hg.left, right: hg.right, top: hg.top, bottom: hg.bottom },
          xAxis: { type: "category", data: data.hourly.map(function (_, h) { return h + "시"; }), axisLabel: { color: muted, fontSize: hg.fs, rotate: hg.rot } },
          yAxis: { type: "value", axisLabel: { color: muted }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          series: [{
            type: "bar",
            data: data.hourly.map(function (v, h) {
              return { value: v, itemStyle: { color: hourBarColor(h), borderRadius: [4, 4, 0, 0] } };
            }),
            markArea: {
              silent: true,
              itemStyle: { color: dark ? "rgba(99,102,241,0.12)" : "rgba(79,70,229,0.08)" },
              data: [[{ xAxis: "0시" }, { xAxis: "5시" }], [{ xAxis: "22시" }, { xAxis: "23시" }]],
            },
          }],
        }));
      }

      if (data.weekdays && document.getElementById("chart-weekday")) {
        var wdEl = document.getElementById("chart-weekday");
        var wg = layout(wdEl);
        var wdCounts = data.weekdays.map(function (w) { return w.count; });
        var wdMax = Math.max.apply(null, wdCounts.concat([1]));
        init("chart-weekday", Object.assign(baseOpt(), {
          grid: { left: wg.leftCat, right: wg.right, top: wg.top, bottom: wg.bottom },
          xAxis: { type: "value", axisLabel: { color: muted, fontSize: wg.fs } },
          yAxis: { type: "category", data: data.weekdays.map(function (w) { return w.label; }), axisLabel: { color: muted, fontSize: wg.fs } },
          series: [{
            type: "bar",
            data: data.weekdays.map(function (w, i) {
              var c = wdColors[i % 7];
              return {
                value: w.count,
                itemStyle: {
                  color: c,
                  borderRadius: [0, 6, 6, 0],
                  shadowBlur: w.count >= wdMax ? 10 : 0,
                  shadowColor: w.count >= wdMax ? (dark ? "rgba(62,232,197,0.45)" : "rgba(15,107,92,0.35)") : "transparent",
                },
              };
            }),
          }],
        }));
      }

      if (data.monthly && document.getElementById("chart-monthly")) {
        var moEl = document.getElementById("chart-monthly");
        var mg = layout(moEl);
        init("chart-monthly", Object.assign(baseOpt(), {
          grid: { left: mg.left, right: mg.right, top: mg.top, bottom: mg.bottom },
          xAxis: { type: "category", data: data.monthly.map(function (m) { return m.label; }), axisLabel: { color: muted, fontSize: mg.fs, rotate: mg.bottomRot } },
          yAxis: { type: "value", axisLabel: { color: muted, fontSize: mg.fs }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
          series: [{ type: "line", smooth: true, data: data.monthly.map(function (m) { return m.count; }), areaStyle: { opacity: 0.12 }, lineStyle: { width: 2, color: accent2 }, itemStyle: { color: accent2 } }],
        }));
      }

      if (data.daily && document.getElementById("chart-daily-heat")) {
        var heatEl = document.getElementById("chart-daily-heat");
        var dg = layout(heatEl);
        var heatMax = Math.max.apply(null, data.daily.map(function (d) { return d.count; }).concat([1]));
        var heat = data.daily.map(function (d) { return [d.date, d.count]; });
        var burstSet = {};
        (data.burstDates || []).forEach(function (d) { burstSet[d] = true; });
        var daySpan = data.daily.length;
        var useBarFallback = daySpan > 0 && daySpan < 90;
        if (useBarFallback) {
          var labels = data.daily.map(function (d) {
            var p = d.date.split("-");
            return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : d.date;
          });
          init("chart-daily-heat", Object.assign(baseOpt(), {
            grid: { left: dg.left, right: dg.right, top: dg.top, bottom: Math.max(dg.bottom, 52), containLabel: true },
            tooltip: { trigger: "axis" },
            xAxis: { type: "category", data: labels, axisLabel: { color: muted, fontSize: dg.fs, rotate: labels.length > 20 ? 40 : 0, interval: labels.length > 40 ? Math.floor(labels.length / 20) : 0 } },
            yAxis: { type: "value", axisLabel: { color: muted }, splitLine: { lineStyle: { color: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } } },
            visualMap: { show: false, min: 0, max: heatMax, inRange: { color: dark ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] } },
            series: [{
              type: "bar",
              data: data.daily.map(function (d) { return d.count; }),
              itemStyle: { borderRadius: [3, 3, 0, 0], borderWidth: 0 },
              emphasis: { itemStyle: { shadowBlur: 10, shadowColor: dark ? "rgba(62,232,197,0.45)" : "rgba(15,107,92,0.35)" } },
            }],
          }));
        } else {
          var cellH = dg.w < 380 ? 12 : dg.w < 640 ? 14 : 16;
          var cellW = dg.w < 380 ? 12 : 14;
          init("chart-daily-heat", Object.assign(baseOpt(), {
            tooltip: { position: "top" },
            visualMap: { min: 0, max: heatMax, calculable: true, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: muted, fontSize: dg.fs }, itemWidth: dg.w < 380 ? 10 : 14, itemHeight: dg.w < 380 ? 60 : 80, inRange: { color: dark ? ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] : ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] } },
            calendar: { top: dg.w < 380 ? 28 : 36, left: dg.left, right: dg.right, cellSize: [cellW, cellH], range: data.daily.length ? [data.daily[0].date, data.daily[data.daily.length - 1].date] : undefined, itemStyle: { borderWidth: 0, borderColor: "transparent" }, dayLabel: { color: muted, fontSize: dg.fs }, monthLabel: { color: muted, fontSize: dg.fs } },
            series: [{ type: "heatmap", coordinateSystem: "calendar", data: heat, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: dark ? "rgba(62,232,197,0.5)" : "rgba(33,110,57,0.45)" } } }],
          }));
        }
      }

      if (data.keywords && document.getElementById("chart-kw-cloud")) {
        var cloudEl = document.getElementById("chart-kw-cloud");
        var cg = layout(cloudEl);
        var cloud = data.keywords.slice(0, 100).map(function (k) {
          return { name: k.label, value: k.count };
        });
        var sizeLo = cg.w < 380 ? 10 : 12;
        var sizeHi = cg.w < 380 ? 34 : cg.w < 640 ? 46 : 56;
        init("chart-kw-cloud", {
          textStyle: baseOpt().textStyle,
          tooltip: { show: true },
          series: [{
            type: "wordCloud",
            shape: "circle",
            gridSize: cg.w < 380 ? 8 : 6,
            sizeRange: [sizeLo, sizeHi],
            rotationRange: [-45, 45],
            textStyle: {
              fontFamily: "Pretendard, Apple SD Gothic Neo, sans-serif",
              color: function () {
                var palette = dark ? ["#3ee8c5", "#818cf8", "#fbbf24", "#fb923c", "#f472b6"] : ["#0f6b5c", "#4f46e5", "#b8860b", "#c45c2a", "#be185d"];
                return palette[Math.floor(Math.random() * palette.length)];
              },
            },
            data: cloud,
          }],
        });
      }

      if (data.participants && document.getElementById("chart-participants")) {
        var pieEl = document.getElementById("chart-participants");
        var pg = layout(pieEl);
        var topN = 10;
        var ranked = data.participants.slice().sort(function (a, b) { return b.messages - a.messages; });
        var topSlice = ranked.slice(0, topN);
        var otherSum = ranked.slice(topN).reduce(function (s, x) { return s + x.messages; }, 0);
        var pieData = topSlice.map(function (x) { return { name: x.alias, value: x.messages }; });
        if (otherSum > 0) pieData.push({ name: "기타", value: otherSum });
        var pieR = pg.w < 380 ? ["40%", "68%"] : ["38%", "66%"];
        init("chart-participants", Object.assign(baseOpt(), {
          tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
          legend: { show: false },
          series: [{
            type: "pie",
            radius: pieR,
            center: ["50%", "48%"],
            avoidLabelOverlap: true,
            minShowLabelAngle: 10,
            data: pieData,
            label: {
              show: true,
              position: "outside",
              color: text,
              fontSize: pg.fs,
              formatter: function (params) {
                var n = params.name || "";
                return n.length > 8 ? n.slice(0, 7) + "…" : n;
              },
            },
            labelLine: { show: true, length: 8, length2: 6, lineStyle: { color: muted } },
            itemStyle: { borderRadius: 4, borderWidth: 0 },
          }],
        }));
      }

      if (data.topicsThemes && data.topicsThemes.length && document.getElementById("chart-topics")) {
        var topEl = document.getElementById("chart-topics");
        var tg = layout(topEl);
        var topics = data.topicsThemes.slice(0, 8);
        init("chart-topics", Object.assign(baseOpt(), {
          grid: { left: Math.max(tg.leftCat, tg.w < 380 ? 72 : 96), right: tg.right, top: tg.top, bottom: tg.bottom },
          xAxis: { type: "value", axisLabel: { color: muted, fontSize: tg.fs, formatter: "{value}%" } },
          yAxis: {
            type: "category",
            data: topics.map(function (t) { return t.title; }).reverse(),
            axisLabel: { color: text, fontSize: tg.fs },
          },
          series: [{
            type: "bar",
            data: topics.map(function (t) { return t.messagePercent; }).reverse(),
            itemStyle: {
              borderRadius: [0, 6, 6, 0],
              color: function (p) { return p.dataIndex % 2 === 0 ? accent : accent2; },
            },
          }],
        }));
      }

      if (data.domains && document.getElementById("chart-domains")) {
        init("chart-domains", Object.assign(baseOpt(), {
          tooltip: { trigger: "item" },
          series: [{
            type: "treemap",
            data: data.domains.map(function (d) { return { name: d.label, value: d.count }; }),
            label: { color: text, fontSize: 11 },
            itemStyle: { borderColor: dark ? "#0d1117" : "#fff", gapWidth: 2 },
          }],
        }));
      }

      if (data.interaction && data.interaction.aliases.length && document.getElementById("chart-dyad")) {
        var ix = data.interaction;
        var heat = [];
        var maxV = 1;
        for (var ri = 0; ri < ix.matrix.length; ri += 1) {
          for (var ci = 0; ci < ix.matrix[ri].length; ci += 1) {
            var v = ix.matrix[ri][ci];
            if (v > maxV) maxV = v;
            if (v > 0) heat.push({ value: [ci, ri, v], label: { show: v >= maxV * 0.15, formatter: String(v), color: text, fontSize: 9 } });
          }
        }
        var dyEl = document.getElementById("chart-dyad");
        var dg = layout(dyEl);
        var splitFill = dark ? ["rgba(255,255,255,0.03)", "rgba(255,255,255,0.06)"] : ["rgba(0,0,0,0.02)", "rgba(0,0,0,0.05)"];
        init("chart-dyad", Object.assign(baseOpt(), {
          tooltip: { position: "top", formatter: function (p) { var v = p.value[2]; return ix.aliases[p.value[1]] + " → " + ix.aliases[p.value[0]] + ": " + v; } },
          grid: { left: Math.max(dg.leftCat, 72), right: dg.right, top: dg.top, bottom: 56 },
          xAxis: {
            type: "category",
            data: ix.aliases,
            axisLabel: { color: muted, fontSize: dg.fs, rotate: 32 },
            splitArea: { show: true, areaStyle: { color: splitFill } },
          },
          yAxis: {
            type: "category",
            data: ix.aliases,
            axisLabel: { color: muted, fontSize: dg.fs },
            splitArea: { show: true, areaStyle: { color: splitFill } },
          },
          visualMap: {
            min: 0,
            max: maxV,
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 4,
            inRange: { color: [heatLo, dark ? "#2a9d8f" : "#7ecfc2", dark ? "#3ee8c5" : "#0f6b5c", heatHi] },
          },
          series: [{
            type: "heatmap",
            data: heat,
            itemStyle: { borderWidth: 0 },
            emphasis: { itemStyle: { shadowBlur: 12, shadowColor: dark ? "rgba(62,232,197,0.5)" : "rgba(15,107,92,0.35)" } },
          }],
        }));
      }
      requestAnimationFrame(resizeAll);
      setTimeout(resizeAll, 150);
      window.addEventListener("resize", resizeAll);
      window.addEventListener("load", resizeAll);
      }
      function whenVisible() {
        var anchor = document.getElementById("s-viz") || document.querySelector(".chart-box");
        if (!anchor || typeof IntersectionObserver === "undefined") {
          run();
          return;
        }
        var started = false;
        var io = new IntersectionObserver(function (entries) {
          if (started) return;
          if (entries.some(function (e) { return e.isIntersecting; })) {
            started = true;
            io.disconnect();
            run();
          }
        }, { rootMargin: "480px 0px", threshold: 0.01 });
        io.observe(anchor);
        setTimeout(function () {
          if (started) return;
          var r = anchor.getBoundingClientRect();
          if (r.top < window.innerHeight + 320) {
            started = true;
            io.disconnect();
            run();
          }
        }, 200);
      }
      function bootCharts() {
        if (typeof echarts === "undefined") return false;
        whenVisible();
        return true;
      }
      if (!bootCharts()) {
        window.addEventListener("load", function () {
          var tries = 0;
          (function wait() {
            if (bootCharts()) return;
            if (++tries > 120) {
              document.querySelectorAll(".chart-box").forEach(function (el) {
                if (!el.querySelector("canvas")) {
                  el.innerHTML = '<p style="margin:0;padding:12px;font-size:12px;color:var(--muted);text-align:center">ECharts CDN을 불러오지 못했습니다.</p>';
                }
              });
              return;
            }
            setTimeout(wait, 50);
          })();
        });
      }
    })();
`;
//# sourceMappingURL=report-charts.js.map