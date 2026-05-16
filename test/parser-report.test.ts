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
import { renderReportHtml } from "../src/report.js";
import { buildReportStory } from "../src/story.js";

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
    assert.equal(html.includes("본문 단어만"), true);
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
  await writeFile(htmlPath, renderReportHtml(emptyReport()), "utf8");
  try {
    const html = await readFile(htmlPath, "utf8");
    assert.match(html, /<!doctype html>/);
    assert.match(html, /카카오톡 대화 리포트/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function emptyReport() {
  return {
    generatedAt: "2026-05-16T00:00:00.000Z",
    privacy: "public-masked" as const,
    source: {
      fileName: "KakaoTalk export",
      chatRoomName: "채팅방",
      encoding: "utf-8" as const,
      physicalLines: 1,
      warnings: 0,
    },
    summary: {
      totalMessages: 0,
      participants: 0,
      activeDays: 0,
      firstMessage: null,
      lastMessage: null,
      averageMessageLength: 0,
      messagesWithLinks: 0,
      messagesWithAttachments: 0,
      messagesPerActiveDay: 0,
      longestActiveStreakDays: 0,
      peakHour: null,
      busiestWeekdayLabel: null,
      medianReplyGapMinutes: null,
      nightSharePercent: 0,
      emojiMessages: 0,
    },
    insights: {
      weekendSharePercent: 0,
      participantGini: null,
      replyGapP90Minutes: null,
      maxSilenceBetweenActiveDays: null,
      top3ParticipantSharePercent: 0,
      linkDomainEntropyBits: null,
      densityMessagesPerCalendarDay: null,
      questionLikeMessagesPer100: 0,
      speakerSwitchRatePer100: 0,
      rhythmScore: 0,
      daypartPercents: [
        { key: "dawn", label: "새벽(0~5시)", percent: 0 },
        { key: "morning", label: "오전(6~11시)", percent: 0 },
        { key: "afternoon", label: "오후(12~17시)", percent: 0 },
        { key: "evening", label: "저녁(18~23시)", percent: 0 },
      ],
      linksPer100: 0,
      attachmentsPer100: 0,
      medianMessagesPerParticipant: null,
      burstGapUnder1mPercent: null,
      gapOver60mPercent: null,
      activeHoursCount: 0,
      keywordTop1SharePercent: null,
      photoShareOfAllAttachmentMarkers: null,
      monologueMessagesPercent: 0,
      peakDaySharePercent: 0,
      uniqueDomainCount: 0,
      replyGapCoeffVariation: null,
    },
    participants: [],
    daily: [],
    hourly: Array.from({ length: 24 }, () => 0),
    weekdays: ["일", "월", "화", "수", "목", "금", "토"].map((d) => ({ label: `${d}요일`, count: 0 })),
    monthly: [],
    attachments: [],
    domains: [],
    keywords: [],
    highlights: [],
    story: buildReportStory({
      chatRoomName: "채팅방",
      totalMessages: 0,
      activeDays: 0,
      firstMessage: null,
      lastMessage: null,
      longestStreak: 0,
      peakHour: null,
      busiestWeekdayLabel: null,
      nightSharePercent: 0,
      emojiMessages: 0,
      participants: [],
      daily: [],
      dailySenderCounts: new Map(),
      senderAliases: new Map(),
      insights: {
        weekendSharePercent: 0,
        participantGini: null,
        replyGapP90Minutes: null,
        maxSilenceBetweenActiveDays: null,
        top3ParticipantSharePercent: 0,
        linkDomainEntropyBits: null,
        densityMessagesPerCalendarDay: null,
        questionLikeMessagesPer100: 0,
        speakerSwitchRatePer100: 0,
        rhythmScore: 0,
        daypartPercents: [],
        linksPer100: 0,
        attachmentsPer100: 0,
        medianMessagesPerParticipant: null,
        burstGapUnder1mPercent: null,
        gapOver60mPercent: null,
        activeHoursCount: 0,
        keywordTop1SharePercent: null,
        photoShareOfAllAttachmentMarkers: null,
        monologueMessagesPercent: 0,
        peakDaySharePercent: 0,
        uniqueDomainCount: 0,
        replyGapCoeffVariation: null,
      },
      laughMessages: 0,
      shortMessages: 0,
      laughBySender: new Map(),
      shortBySender: new Map(),
    }),
    roomEvents: {
      joinCount: 0,
      leaveCount: 0,
      deletedCount: 0,
      total: 0,
      joinSharePercent: 0,
      leaveSharePercent: 0,
      deletedSharePercent: 0,
    },
  };
}
