const FIVE_MIB = 5 * 1024 * 1024;
export function renderReportHtml(data) {
    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>카카오톡 대화 리포트 · kca</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f1ea;
      --bg2: #e8e2d6;
      --ink: #141a1f;
      --muted: #5c6670;
      --line: #d4cdc2;
      --panel: #fffcf7;
      --accent: #0f6b5c;
      --accent2: #c45c2a;
      --gold: #b8860b;
      --shadow: 0 18px 50px rgba(20, 26, 31, 0.08);
      font-family: "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", ui-sans-serif, system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(1200px 500px at 10% -10%, rgba(15,107,92,0.12), transparent), linear-gradient(180deg, var(--bg), var(--bg2)); color: var(--ink); }
    main { width: min(1200px, calc(100% - 36px)); margin: 0 auto; padding: 36px 0 56px; }
    .hero { display: grid; gap: 20px; grid-template-columns: 1.35fr 1fr; align-items: stretch; padding-bottom: 28px; }
    h1 { margin: 0; font-size: clamp(28px, 4.2vw, 48px); line-height: 1.08; letter-spacing: -0.03em; font-weight: 800; }
    .sub { margin: 12px 0 0; color: var(--muted); line-height: 1.65; font-size: 15px; max-width: 52ch; }
    .badge-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .badge { font-size: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.65); color: var(--muted); }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px; box-shadow: var(--shadow); }
    .side-card { display: flex; flex-direction: column; gap: 10px; justify-content: center; }
    .side-card p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
    .side-card strong { color: var(--ink); }
    h2 { margin: 0 0 12px; font-size: 17px; font-weight: 750; letter-spacing: -0.02em; }
    .grid { display: grid; gap: 14px; }
    .metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .metrics6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .metric .label { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .metric .value { font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; }
    .metric .sub { display: block; color: var(--muted); font-size: 11px; margin-top: 6px; }
    .highlights { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .highlights li { padding: 12px 14px; border-radius: 10px; background: linear-gradient(120deg, rgba(15,107,92,0.08), rgba(196,92,42,0.06)); border: 1px solid rgba(15,107,92,0.15); font-size: 14px; line-height: 1.55; }
    .highlights strong { color: var(--accent); font-weight: 750; }
    .bars { display: grid; gap: 8px; }
    .bar-row { display: grid; grid-template-columns: minmax(72px, 1fr) minmax(0, 2.2fr) 52px; gap: 10px; align-items: center; min-height: 22px; }
    .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .bar-track { height: 9px; background: #e5dfd4; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; width: var(--w); background: linear-gradient(90deg, var(--accent), #1a9d87); border-radius: inherit; }
    .bar-value { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; font-size: 12px; }
    .calendar { display: grid; gap: 3px; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); }
    .day { aspect-ratio: 1; border-radius: 6px; background: color-mix(in srgb, var(--accent) var(--level), #e5dfd4); display: grid; place-items: center; font-size: 9px; color: #0c2a24; font-weight: 650; }
    .hours { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; align-items: end; height: 140px; }
    .hour { min-width: 0; background: linear-gradient(180deg, var(--accent2), #e07a45); border-radius: 3px 3px 0 0; height: var(--h); }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th, .table td { text-align: left; border-bottom: 1px solid var(--line); padding: 9px 6px; }
    .table th { color: var(--muted); font-weight: 650; font-size: 11px; text-transform: none; }
    .table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    footer { margin-top: 28px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    @media (max-width: 900px) {
      .hero, .two, .three, .metrics, .metrics6 { grid-template-columns: 1fr; }
      .hours { grid-template-columns: repeat(12, 1fr); height: 120px; }
    }
  </style>
</head>
<body>
  <main>
    <header class="hero">
      <div>
        <h1>카카오톡 대화 리포트</h1>
        <p class="sub">원문 메시지·전체 URL은 저장하지 않습니다. 참여자는 <strong>부분 마스킹된 표시명</strong>으로만 보여요. 아래는 집계·리듬·키워드 중심의 인사이트입니다.</p>
        <div class="badge-row">
          <span class="badge">프라이버시: ${escapeHtml(privacyLabel(data.privacy))}</span>
          <span class="badge">인코딩: ${escapeHtml(data.source.encoding)}</span>
          <span class="badge">경고: ${data.source.warnings}건</span>
        </div>
      </div>
      <div class="card side-card">
        <p><strong>생성 시각</strong><br>${escapeHtml(formatTimestamp(data.generatedAt))}</p>
        <p><strong>첫 메시지</strong><br>${escapeHtml(data.summary.firstMessage ?? "—")}</p>
        <p><strong>마지막 메시지</strong><br>${escapeHtml(data.summary.lastMessage ?? "—")}</p>
      </div>
    </header>

    ${data.highlights.length > 0
        ? `<section class="card" style="margin-bottom:16px"><h2>하이라이트</h2><ul class="highlights">${data.highlights.map((h) => `<li>${renderHighlightLine(h)}</li>`).join("")}</ul></section>`
        : ""}

    <section class="grid metrics" style="margin-bottom:14px">
      ${metric("총 메시지", formatNumber(data.summary.totalMessages), `활동일 ${formatNumber(data.summary.activeDays)}일`)}
      ${metric("참여자", formatNumber(data.summary.participants), "부분 마스킹 표시")}
      ${metric("평균 길이", `${data.summary.averageMessageLength}`, "글자 수 기준")}
      ${metric("URL 포함", formatNumber(data.summary.messagesWithLinks), "메시지 수")}
    </section>

    <section class="grid metrics6" style="margin-bottom:14px">
      ${metric("활동일당 평균", `${data.summary.messagesPerActiveDay}`, "메시지 / 활동일")}
      ${metric("최장 연속일", `${data.summary.longestActiveStreakDays}`, "메시지가 있었던 날 기준")}
      ${metric("심야 비중", `${data.summary.nightSharePercent}%`, "23~05시")}
      ${metric("응답 간격 중앙값", data.summary.medianReplyGapMinutes !== null ? `${data.summary.medianReplyGapMinutes}분` : "—", "연속 메시지 기준")}
      ${metric("피크 타임", data.summary.peakHour !== null ? `${data.summary.peakHour}시` : "—", "가장 붐빈 시각")}
      ${metric("이모지 느낌", formatNumber(data.summary.emojiMessages), "감지된 메시지")}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("일별 활동 히트맵", renderDaily(data.daily))}
      ${panel("시간대 리듬 (0~23시)", renderHours(data.hourly))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("참여자 랭킹", renderParticipants(data.participants))}
      ${panel("요일별 활동", renderCountBars(data.weekdays))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("월별 추이", renderMonthly(data.monthly))}
      ${panel("첨부 유형", renderCountBars(data.attachments))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("자주 나온 도메인", renderCountBars(data.domains))}
      ${panel("키워드 스냅샷", renderCountBars(data.keywords))}
    </section>

    <script type="application/json" id="report-data">${escapeJsonForHtml(data)}</script>
    <footer>${escapeHtml(data.source.fileName)} · 경고 ${data.source.warnings}건 · 본 리포트는 통계 목적이며 법적·회계적 증빙으로 사용할 수 없습니다.</footer>
  </main>
</body>
</html>`;
    const size = Buffer.byteLength(html, "utf8");
    if (size > FIVE_MIB) {
        throw new Error(`Generated HTML is ${size} bytes, which exceeds the 5 MiB BrewPage HTML limit.`);
    }
    return html;
}
function privacyLabel(mode) {
    if (mode === "public-masked")
        return "부분 마스킹(기본)";
    if (mode === "public-anonymous")
        return "완전 별칭(User 001)";
    return mode;
}
function metric(label, value, sub) {
    return `<div class="card metric"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span><span class="sub">${escapeHtml(sub)}</span></div>`;
}
function panel(title, content) {
    return `<div class="card"><h2>${escapeHtml(title)}</h2>${content}</div>`;
}
function renderDaily(days) {
    if (days.length === 0)
        return `<p style="margin:0;color:var(--muted);font-size:13px">날짜가 있는 메시지가 없습니다.</p>`;
    const max = Math.max(...days.map((day) => day.count), 1);
    return `<div class="calendar">${days
        .map((day) => {
        const level = Math.max(8, Math.round((day.count / max) * 85));
        return `<div class="day" title="${escapeHtml(day.date)} · ${day.count}건" style="--level: ${level}%">${day.count}</div>`;
    })
        .join("")}</div>`;
}
function renderMonthly(months) {
    if (months.length === 0)
        return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
    return renderCountBars(months.map((m) => ({ label: m.date, count: m.count })));
}
function renderHours(hours) {
    const max = Math.max(...hours, 1);
    return `<div class="hours">${hours
        .map((count, hour) => {
        const height = Math.max(2, Math.round((count / max) * 100));
        return `<div class="hour" title="${hour}시 · ${count}건" style="--h: ${height}%"></div>`;
    })
        .join("")}</div>`;
}
function renderParticipants(participants) {
    if (participants.length === 0) {
        return `<p style="margin:0;color:var(--muted);font-size:13px">참여자 데이터가 없습니다.</p>`;
    }
    return `<table class="table"><thead><tr><th>표시명</th><th class="num">메시지</th><th class="num">비율</th><th class="num">평균 길이</th><th class="num">URL</th><th class="num">첨부</th><th class="num">심야</th><th class="num">연속 최대</th></tr></thead><tbody>${participants
        .map((p) => `<tr><td>${escapeHtml(p.alias)}</td><td class="num">${formatNumber(p.messages)}</td><td class="num">${p.sharePercent}%</td><td class="num">${p.averageLength}</td><td class="num">${formatNumber(p.linkMessages)}</td><td class="num">${formatNumber(p.attachmentMessages)}</td><td class="num">${formatNumber(p.nightMessages)}</td><td class="num">${formatNumber(p.maxConsecutive)}</td></tr>`)
        .join("")}</tbody></table>`;
}
function renderCountBars(items) {
    if (items.length === 0)
        return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
    const max = Math.max(...items.map((item) => item.count), 1);
    return `<div class="bars">${items
        .map((item) => {
        const width = Math.max(2, Math.round((item.count / max) * 100));
        return `<div class="bar-row"><span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span><span class="bar-track"><span class="bar-fill" style="--w: ${width}%"></span></span><span class="bar-value">${formatNumber(item.count)}</span></div>`;
    })
        .join("")}</div>`;
}
function renderHighlightLine(line) {
    const parts = line.split("**");
    return parts.map((part, i) => (i % 2 === 1 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part))).join("");
}
function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(value);
}
function formatTimestamp(value) {
    try {
        return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    }
    catch {
        return value;
    }
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function escapeJsonForHtml(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
//# sourceMappingURL=report.js.map