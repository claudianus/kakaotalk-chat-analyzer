import type { ReportData } from "./types.js";
import { escapeHtml, formatNumber } from "./report-util.js";

export function renderCompareHtml(reports: ReportData[]): string {
  const rows = reports
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.source.chatRoomName)}</td>
        <td class="num">${formatNumber(r.summary.totalMessages)}</td>
        <td class="num">${formatNumber(r.summary.participants)}</td>
        <td class="num">${r.insights.rhythmScore}</td>
        <td class="num">${r.insights.participantGini ?? "—"}</td>
        <td class="num">${r.summary.nightSharePercent}%</td>
        <td>${escapeHtml(r.conversationPace.label)}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>kca 방 비교</title>
  <style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}.num{text-align:right;font-variant-numeric:tabular-nums}</style>
  </head><body><h1>카카오톡 방 비교</h1><p>집계만 비교합니다. 원문 미포함.</p>
  <table><thead><tr><th>방</th><th>메시지</th><th>참여자</th><th>리듬</th><th>지니</th><th>심야%</th><th>템포</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;
}
