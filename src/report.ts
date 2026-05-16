import type { CountItem, DailyCount, ParticipantStat, ReportData } from "./types.js";

const FIVE_MIB = 5 * 1024 * 1024;

export function renderReportHtml(data: ReportData): string {
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KakaoTalk Chat Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f4ed;
      --ink: #1e2428;
      --muted: #667078;
      --line: #d9d4ca;
      --panel: #ffffff;
      --accent: #0e7c86;
      --accent-2: #cb4d35;
      --soft: #e8f4f3;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
    header { display: grid; gap: 16px; grid-template-columns: 1.4fr .9fr; align-items: end; padding: 24px 0 28px; }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 64px); line-height: .95; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    section { margin-top: 18px; }
    .note { border-left: 4px solid var(--accent); padding-left: 14px; }
    .grid { display: grid; gap: 14px; }
    .metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .metric .label { display: block; color: var(--muted); font-size: 13px; margin-bottom: 8px; }
    .metric .value { font-size: 30px; font-weight: 750; line-height: 1; }
    .metric .sub { display: block; color: var(--muted); font-size: 12px; margin-top: 8px; }
    .bars { display: grid; gap: 9px; }
    .bar-row { display: grid; grid-template-columns: minmax(86px, 150px) minmax(0, 1fr) 56px; gap: 10px; align-items: center; min-height: 24px; }
    .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .bar-track { height: 10px; background: #ebe6db; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; width: var(--w); background: var(--accent); border-radius: inherit; }
    .bar-value { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; font-size: 13px; }
    .calendar { display: grid; gap: 4px; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); }
    .day { aspect-ratio: 1; border-radius: 6px; background: color-mix(in srgb, var(--accent) var(--level), #ebe6db); display: grid; place-items: center; font-size: 10px; color: #193235; }
    .hours { display: grid; grid-template-columns: repeat(24, 1fr); gap: 4px; align-items: end; height: 150px; }
    .hour { min-width: 0; background: var(--accent-2); border-radius: 4px 4px 0 0; height: var(--h); }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { text-align: left; border-bottom: 1px solid var(--line); padding: 10px 8px; font-size: 13px; }
    .table th { color: var(--muted); font-weight: 650; }
    footer { margin-top: 24px; color: var(--muted); font-size: 12px; }
    @media (max-width: 860px) {
      header, .two, .metrics { grid-template-columns: 1fr; }
      main { width: min(100% - 20px, 720px); padding-top: 14px; }
      .hours { grid-template-columns: repeat(12, 1fr); height: 120px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>KakaoTalk Chat Report</h1>
        <p class="note">익명화된 집계 통계만 포함되어 있습니다. 원문 메시지, 실제 참여자명, 전체 URL은 이 HTML에 저장하지 않습니다.</p>
      </div>
      <div class="card">
        <p>Generated ${escapeHtml(formatTimestamp(data.generatedAt))}</p>
        <p>${escapeHtml(data.summary.firstMessage ?? "n/a")} - ${escapeHtml(data.summary.lastMessage ?? "n/a")}</p>
      </div>
    </header>

    <section class="grid metrics">
      ${metric("Messages", formatNumber(data.summary.totalMessages), `${data.summary.activeDays} active days`)}
      ${metric("Participants", formatNumber(data.summary.participants), "anonymized aliases")}
      ${metric("Avg Length", `${data.summary.averageMessageLength}`, "characters")}
      ${metric("Links", formatNumber(data.summary.messagesWithLinks), "messages with URLs")}
    </section>

    <section class="grid two">
      ${panel("Daily Activity", renderDaily(data.daily))}
      ${panel("Hourly Rhythm", renderHours(data.hourly))}
    </section>

    <section class="grid two">
      ${panel("Top Participants", renderParticipants(data.participants))}
      ${panel("Weekday Activity", renderCountBars(data.weekdays))}
    </section>

    <section class="grid two">
      ${panel("Attachments", renderCountBars(data.attachments))}
      ${panel("Top Domains", renderCountBars(data.domains))}
    </section>

    <section>
      ${panel("Top Keywords", renderCountBars(data.keywords))}
    </section>

    <script type="application/json" id="report-data">${escapeJsonForHtml(data)}</script>
    <footer>Privacy mode: ${escapeHtml(data.privacy)}. Source label: ${escapeHtml(data.source.fileName)}. Parse warnings: ${data.source.warnings}.</footer>
  </main>
</body>
</html>`;

  const size = Buffer.byteLength(html, "utf8");
  if (size > FIVE_MIB) {
    throw new Error(`Generated HTML is ${size} bytes, which exceeds the 5 MiB BrewPage HTML limit.`);
  }
  return html;
}

function metric(label: string, value: string, sub: string): string {
  return `<div class="card metric"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span><span class="sub">${escapeHtml(sub)}</span></div>`;
}

function panel(title: string, content: string): string {
  return `<div class="card"><h2>${escapeHtml(title)}</h2>${content}</div>`;
}

function renderDaily(days: DailyCount[]): string {
  if (days.length === 0) return `<p>No dated messages found.</p>`;
  const max = Math.max(...days.map((day) => day.count), 1);
  return `<div class="calendar">${days
    .map((day) => {
      const level = Math.max(8, Math.round((day.count / max) * 82));
      return `<div class="day" title="${escapeHtml(day.date)}: ${day.count}" style="--level: ${level}%">${day.count}</div>`;
    })
    .join("")}</div>`;
}

function renderHours(hours: number[]): string {
  const max = Math.max(...hours, 1);
  return `<div class="hours">${hours
    .map((count, hour) => {
      const height = Math.max(2, Math.round((count / max) * 100));
      return `<div class="hour" title="${hour}:00 ${count}" style="--h: ${height}%"></div>`;
    })
    .join("")}</div>`;
}

function renderParticipants(participants: ParticipantStat[]): string {
  if (participants.length === 0) return `<p>No participant data.</p>`;
  return `<table class="table"><thead><tr><th>Alias</th><th>Messages</th><th>Avg len</th><th>Links</th><th>Attach.</th></tr></thead><tbody>${participants
    .map(
      (participant) =>
        `<tr><td>${escapeHtml(participant.alias)}</td><td>${formatNumber(participant.messages)}</td><td>${participant.averageLength}</td><td>${formatNumber(participant.linkMessages)}</td><td>${formatNumber(participant.attachmentMessages)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

function renderCountBars(items: CountItem[]): string {
  if (items.length === 0) return `<p>No data.</p>`;
  const max = Math.max(...items.map((item) => item.count), 1);
  return `<div class="bars">${items
    .map((item) => {
      const width = Math.max(2, Math.round((item.count / max) * 100));
      return `<div class="bar-row"><span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span><span class="bar-track"><span class="bar-fill" style="--w: ${width}%"></span></span><span class="bar-value">${formatNumber(item.count)}</span></div>`;
    })
    .join("")}</div>`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatTimestamp(value: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
