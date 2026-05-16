import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildReportData,
  buildReportFromExport,
  maskPartialDisplayName,
  parseChatRoomNameFromExportPath,
} from "../src/analysis.js";
import { parseKakaoExport } from "../src/parser.js";
import { emptyReportData } from "../src/report-empty.js";
import { renderReportHtml } from "../src/report.js";

test("parseChatRoomNameFromExportPath strips KakaoTalk export filename parts", () => {
  assert.equal(
    parseChatRoomNameFromExportPath(
      "/Downloads/KakaoTalk_Chat_자연어처리와 딥러닝 2024_2026-05-16-15-03-41.csv",
    ),
    "자연어처리와 딥러닝 2024",
  );
});

test("parses KakaoTalk CSV export with multiline continuation lines", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-parser-"));
  const csvPath = join(dir, "chat.csv");
  await writeFile(
    csvPath,
    [
      "Date,User,Message",
      '2026-05-01 09:00:00,"Alice","hello secret-project https://example.com/path?token=123"',
      "continued detail",
      '2026-05-01 09:05:00,"Bob","사진"',
      '2026-05-01 10:00:00,"Alice","회의 확인"',
    ].join("\n"),
    "utf8",
  );

  try {
    const parsed = await parseKakaoExport(csvPath);
    assert.equal(parsed.records.length, 3);
    assert.equal(parsed.records[0]?.message.includes("continued detail"), true);
    assert.equal(parsed.warnings.length, 0);

    const data = buildReportData(parsed, { privacy: "public-masked" });
    assert.equal(parseChatRoomNameFromExportPath(csvPath), "chat");
    assert.equal(data.source.chatRoomName, "chat");
    assert.equal(data.summary.totalMessages, 3);
    assert.equal(data.summary.participants, 2);
    assert.equal(data.attachments[0]?.label, "사진");
    assert.equal(maskPartialDisplayName("Alice"), "A***e");
    assert.equal(maskPartialDisplayName("Bob"), "B*b");

    const html = renderReportHtml(data);
    assert.equal(html.includes('class="room-title"'), true);
    assert.match(html, /room-title[^>]*>chat</);
    assert.equal(Buffer.byteLength(html, "utf8") < 5 * 1024 * 1024, true);
    assert.equal(html.includes("Alice"), false);
    assert.equal(html.includes("Bob"), false);
    assert.equal(html.includes("https://example.com/path?token=123"), false);
    assert.equal(html.includes("hello secret-project https://example.com/path?token=123"), false);
    assert.equal(html.includes("A***e"), true);
    assert.equal(html.includes("example.com"), true);
    assert.equal(html.includes("하이라이트"), true);
    assert.equal(html.includes("data-kca-jump"), true);
    assert.equal(html.includes("[data-kca-jump]"), true);
    assert.equal(html.includes("data-kca-external"), true);
    assert.equal(html.includes("data-kca-external-url"), true);
    assert.match(
      html,
      /data-kca-external-url="https:\/\/github\.com\/claudianus\/kakaotalk-chat-analyzer"/,
    );
    assert.equal(html.includes("window.top.location"), false);
    assert.equal(html.includes("report-data"), false);
    assert.equal(html.includes("gh-contrib"), true);
    assert.equal(html.includes('id="s-wrapped"'), true);
    assert.equal(html.includes("wrapped-card"), true);
    assert.equal(html.includes("overflow-x: clip"), true);
    assert.equal(html.includes("gh-cal-scroll"), true);
    assert.match(html, /\.gh-cal-scroll\s*\{[^}]*overflow-x:\s*auto/);
    assert.equal(html.includes("bubble-node"), true);
    assert.equal(html.includes("sc-plot-list"), true);
    assert.equal(html.includes("persona-chip"), true);
    assert.equal(html.includes("story-headline"), true);
    assert.ok(data.story.wrapped.length >= 3);

    const streamed = await buildReportFromExport(csvPath, { privacy: "public-masked" });
    assert.equal(streamed.summary.totalMessages, data.summary.totalMessages);
    assert.equal(streamed.summary.participants, data.summary.participants);
    assert.equal(html.includes("hours-split"), true);
    assert.equal(html.includes("table-rank"), true);
    assert.equal(html.includes("Kiwi"), true);
    assert.equal(html.includes('id="kca-chart-data"'), true);
    assert.equal(html.includes('id="chart-kw-cloud"'), true);
    const echartsPos = html.indexOf("echarts@5.6.0/dist/echarts.min.js");
    const initPos = html.indexOf('getElementById("kca-chart-data")');
    assert.ok(echartsPos > 0 && initPos > echartsPos, "echarts CDN must load before chart init");
    assert.equal(html.includes("<script defer>\n    \n    (function () {\n      var dataEl"), false);
    assert.equal(html.includes("카피페asta"), false);
    const photoKw = data.keywords.find((k) => k.label === "사진");
    assert.equal(photoKw, undefined);
    assert.equal(data.highlights.length > 0, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("public-anonymous privacy uses User 001 style labels", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-anon-"));
  const csvPath = join(dir, "chat.csv");
  await writeFile(csvPath, ["Date,User,Message", '2026-05-01 09:00:00,"X","hi"'].join("\n"), "utf8");
  try {
    const parsed = await parseKakaoExport(csvPath);
    const data = buildReportData(parsed, { privacy: "public-anonymous" });
    const html = renderReportHtml(data);
    assert.equal(html.includes("User 001"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generated report file can be read back as standalone HTML", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-report-"));
  const htmlPath = join(dir, "index.html");
  await writeFile(htmlPath, renderReportHtml(emptyReportData()), "utf8");
  try {
    const html = await readFile(htmlPath, "utf8");
    assert.match(html, /<!doctype html>/);
    assert.match(html, /카카오톡 대화 리포트/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

