import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBenchmarkBandsFromValues } from "../src/benchmark-bands.js";
import { buildPeriodCompare } from "../src/period-compare.js";
import { buildRoomNarrative } from "../src/room-narrative.js";
import { emptyReportData } from "../src/report-empty.js";
import { renderReportHtml } from "../src/report.js";
import { REPORT_STYLES } from "../src/report-styles.js";

describe("innovation layer", () => {
  it("buildRoomNarrative returns paragraphs", () => {
    const n = buildRoomNarrative({
      chatRoomName: "테스트방",
      totalMessages: 100,
      participants: 3,
      pace: { label: "빠른 왕복", emoji: "💨", detail: "test" },
      insights: {
        weekendSharePercent: 20,
        participantGini: 0.5,
        replyGapP90Minutes: 10,
        maxSilenceBetweenActiveDays: 2,
        top3ParticipantSharePercent: 60,
        linkDomainEntropyBits: 1,
        densityMessagesPerCalendarDay: 5,
        questionLikeMessagesPer100: 2,
        speakerSwitchRatePer100: 50,
        rhythmScore: 55,
        daypartPercents: [],
        linksPer100: 1,
        attachmentsPer100: 2,
        medianMessagesPerParticipant: 30,
        burstGapUnder1mPercent: 40,
        gapOver60mPercent: 5,
        activeHoursCount: 12,
        keywordTop1SharePercent: 10,
        photoShareOfAllAttachmentMarkers: 50,
        monologueMessagesPercent: 10,
        peakDaySharePercent: 15,
        uniqueDomainCount: 2,
        replyGapCoeffVariation: 1,
        lexicalTypeRichnessPercent: 20,
        sessionCount: 3,
        avgMessagesPerSession: 12,
        medianSessionMinutes: 45,
      },
      topics: [],
      personas: [],
      events: [],
      topDyadLabel: null,
    });
    assert.ok(n.paragraphs.length >= 1);
    assert.match(n.ogSummary, /테스트방/);
  });

  it("benchmark bands assign percentiles", () => {
    const b = buildBenchmarkBandsFromValues({
      participantGini: 0.7,
      nightSharePercent: 25,
      speakerSwitchRatePer100: 55,
      rhythmScore: 60,
      weekendSharePercent: 30,
    });
    assert.equal(b.length, 5);
    assert.ok(b[0]!.percentile >= 1 && b[0]!.percentile <= 99);
  });

  it("renderReportHtml includes innovation sections", () => {
    const html = renderReportHtml(emptyReportData());
    assert.match(html, /kca-explorer-data/);
    assert.match(html, /class="kca-oled"/);
  });

  it("renderReportHtml includes all 8 new innovation deck sections", () => {
    const data = emptyReportData();
    data.summary.totalMessages = 100;
    data.summary.peakHour = 21;
    data.summary.nightSharePercent = 15;
    data.hourly = Array.from({ length: 24 }, (_, i) => (i === 21 ? 30 : i % 6 === 0 ? 2 : 0));
    data.participants = [
      { alias: "Alice", messages: 60, characters: 300, averageLength: 5, attachmentMessages: 0, linkMessages: 0, sharePercent: 60, characterSharePercent: 60, nightMessages: 5, maxConsecutive: 3 },
      { alias: "Bob", messages: 40, characters: 200, averageLength: 5, attachmentMessages: 0, linkMessages: 0, sharePercent: 40, characterSharePercent: 40, nightMessages: 3, maxConsecutive: 2 },
    ];
    data.insights.sessionCount = 3;
    data.insights.medianSessionMinutes = 25;
    data.insights.maxSilenceBetweenActiveDays = 1;
    data.insights.burstGapUnder1mPercent = 35;
    data.insights.gapOver60mPercent = 40;
    data.insights.participantGini = 0.2;
    data.insights.top3ParticipantSharePercent = 100;
    data.insights.monologueMessagesPercent = 10;
    data.dailySentiment = [
      { date: "2026-01-01", positive: 30, negative: 10, neutral: 60, energy: 20 },
      { date: "2026-01-02", positive: 50, negative: 5, neutral: 45, energy: 45 },
      { date: "2026-01-03", positive: 20, negative: 30, neutral: 50, energy: -10 },
    ];
    data.smartTopicTrend = {
      granularity: "daily",
      label: "일간 토픽 흐름",
      hint: "날짜별 상위 키워드",
      items: [
        { period: "2026-01-01", topics: [{ name: "시작", value: 5 }] },
        { period: "2026-01-02", topics: [{ name: "계속", value: 3 }] },
      ],
    };
    data.replyLatency = {
      roomMedianMinutes: 2.5,
      roomP90Minutes: 12,
      totalReplies: 50,
      fastRatePercent: 40,
      normalRatePercent: 45,
      slowRatePercent: 15,
      responders: [
        { alias: "Alice", medianMinutes: 1.5, p90Minutes: 8, replies: 25, fastRatePercent: 60 },
        { alias: "Bob", medianMinutes: 4, p90Minutes: 18, replies: 25, fastRatePercent: 20 },
      ],
    };
    data.questionAnswer = {
      totalQuestions: 10,
      answeredQuestions: 8,
      answerRatePercent: 80,
      medianAnswerMinutes: 3,
      topAnswerers: [{ alias: "Alice", answers: 5 }],
      topPairs: [{ asker: "Bob", answerer: "Alice", questions: 5, medianAnswerMinutes: 2 }],
    };
    data.burstAnatomy = [
      { date: "2026-01-02", messages: 50, participants: ["Alice", "Bob"], topKeywords: ["테스트"], durationHours: null, vsAverage: 2.5 },
    ];
    data.keywordGravity = [
      { label: "테스트", appearances: 10, followUpMessages: 25, gravity: 2.5, medianFollowUpMinutes: 2, topCoKeywords: ["확인"] },
      { label: "회의", appearances: 8, followUpMessages: 16, gravity: 2, medianFollowUpMinutes: 3, topCoKeywords: ["일정"] },
      { label: "배포", appearances: 5, followUpMessages: 8, gravity: 1.6, medianFollowUpMinutes: 5, topCoKeywords: [] },
    ];

    const html = renderReportHtml(data);
    assert.match(html, /id="s-sentiment"/);
    assert.match(html, /id="s-rhythm"/);
    assert.match(html, /id="s-dynamics"/);
    assert.match(html, /id="s-daypart"/);
    assert.match(html, /id="s-topicflow"/);
    assert.match(html, /id="s-latency"/);
    assert.match(html, /id="s-qa"/);
    assert.match(html, /id="s-burst-anatomy"/);
    assert.match(html, /id="s-keyword-gravity"/);
    assert.match(html, /감정 롤러코스터/);
    assert.match(html, /대화 리듬 & 침묵 지도/);
    assert.match(html, /누가 얼마나 말하나/);
    assert.match(html, /시간대 지문/);
    assert.match(html, /토픽 플로우/);
    assert.match(html, /누가 빨리 답하나/);
    assert.match(html, /질문-응답 지도/);
    assert.match(html, /대화가 몰린 날/);
    assert.match(html, /키워드 중력/);
  });

  it("participant dynamics and latency bar fills use display:block", () => {
    assert.match(REPORT_STYLES, /\.dynamics-fill\s*\{[^}]*display:\s*block/);
    assert.match(REPORT_STYLES, /\.latency-fill\s*\{[^}]*display:\s*block/);
    assert.match(REPORT_STYLES, /\.bar-fill\s*\{[^}]*display:\s*block/);
  });

  it("renderReportHtml has no duplicate element ids", () => {
    const data = emptyReportData();
    data.summary.totalMessages = 100;
    data.summary.peakHour = 21;
    data.summary.nightSharePercent = 15;
    data.hourly = Array.from({ length: 24 }, (_, i) => (i === 21 ? 30 : i % 6 === 0 ? 2 : 0));
    data.dailySentiment = [
      { date: "2026-01-01", positive: 30, negative: 10, neutral: 60, energy: 20 },
      { date: "2026-01-02", positive: 50, negative: 5, neutral: 45, energy: 45 },
      { date: "2026-01-03", positive: 20, negative: 30, neutral: 50, energy: -10 },
    ];
    data.sentiment = {
      sampleSize: 100,
      positivePercent: 40,
      negativePercent: 10,
      neutralPercent: 50,
      compoundScore: 15,
      bySender: [],
    };
    data.recentSnapshot = {
      lastDate: "2026-01-01",
      reportDay: "2026-01-01",
      today: null,
      weekTotal: 50,
      weekVsOverall: 1.2,
      weekParticipants: 5,
      weekKeywords: ["테스트"],
      week: [
        {
          date: "2026-01-01",
          messageCount: 10,
          activeParticipants: 2,
          topSenders: [{ alias: "A", count: 6 }],
          vsAvg: 1,
          keywords: ["키워드"],
          sentiment: { positive: 3, negative: 1, neutral: 6 },
          hourly: Array.from({ length: 24 }, () => 0),
          peakHour: 21,
        },
      ],
    };
    data.dailyHotTopics = [
      {
        date: "2026-01-01",
        title: "테스트",
        summary: "요약",
        keywords: ["키워드"],
        evidence: [],
        messageCount: 10,
        lift: 1.2,
        participants: ["A"],
      },
    ];

    const html = renderReportHtml(data);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    const seen = new Map<string, number>();
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
    const dups = [...seen.entries()].filter(([, count]) => count > 1);
    assert.deepEqual(dups, [], `duplicate ids: ${dups.map(([id, n]) => `${id}×${n}`).join(", ")}`);
    assert.equal((html.match(/href="#s-wrapped"[^>]*>⓪ Wrapped/g) ?? []).length, 1);
    assert.match(html, /id="s-recent"/);
  });

  it("period compare keyword shift", () => {
    const pc = buildPeriodCompare({
      activityArc: [{ id: "whole", label: "전체", messages: 10, activeDays: 2 }],
      daily: [],
      monthly: [],
      headKeywords: [{ label: "alpha", count: 5 }],
      tailKeywords: [{ label: "beta", count: 4 }],
    });
    assert.deepEqual(pc.keywordShift.onlyHead, ["alpha"]);
    assert.deepEqual(pc.keywordShift.onlyTail, ["beta"]);
  });
});
