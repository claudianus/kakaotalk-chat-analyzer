import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportData } from "../src/report-empty.js";
import { renderReportHtml } from "../src/report.js";
import {
  renderActivityRestRhythm,
  renderChemistryCards,
} from "../src/report-innovation.js";
import {
  renderRoomCultureStrip,
  renderSentimentWeatherStrip,
} from "../src/report-llm-deck.js";
import {
  hasActivityRestRhythm,
  hasRoomCultureStrip,
  hasSentimentWeatherStrip,
} from "../src/report-section-visibility.js";

describe("next report innovations", () => {
  it("visibility functions gate new strips correctly", () => {
    const data = emptyReportData();
    assert.equal(hasSentimentWeatherStrip(data), false);
    assert.equal(hasActivityRestRhythm(data), false);
    assert.equal(hasRoomCultureStrip(data), false);

    data.dailySentiment = [
      { date: "2026-01-01", positive: 30, negative: 10, neutral: 60, energy: 20 },
      { date: "2026-01-02", positive: 50, negative: 5, neutral: 45, energy: 45 },
      { date: "2026-01-03", positive: 20, negative: 30, neutral: 50, energy: -10 },
    ];
    assert.equal(hasSentimentWeatherStrip(data), true);

    data.daily = [
      { date: "2026-01-01", count: 10 },
      { date: "2026-01-02", count: 0 },
      { date: "2026-01-03", count: 5 },
    ];
    assert.equal(hasActivityRestRhythm(data), true);

    data.repeatedPhrases = [{ label: "ㅎㅇ", count: 5, peakDate: "2026-01-01" }];
    assert.equal(hasRoomCultureStrip(data), true);
  });

  it("renderSentimentWeatherStrip renders 7 days with weather icons", () => {
    const data = emptyReportData();
    data.recentSnapshot = {
      lastDate: "2026-01-07",
      reportDay: "2026-01-07",
      week: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-01-0${i + 1}`,
        messageCount: 10 + i,
        activeParticipants: 2,
        topSenders: [],
        keywords: [],
        sentiment: { positive: i === 6 ? 60 : 30, negative: i === 6 ? 5 : 10, neutral: i === 6 ? 35 : 60 },
        hourly: Array.from({ length: 24 }, () => 0),
        peakHour: null,
        vsAvg: 1,
      })),
      today: null,
      weekTotal: 77,
      weekVsOverall: 1,
      weekParticipants: 2,
      weekKeywords: [],
    };
    const html = renderSentimentWeatherStrip(data);
    assert.match(html, /id="s-sentiment-weather"/);
    assert.match(html, /sww-icon--sun/);
  });

  it("renderRoomCultureStrip combines repeated phrases and inside jokes", () => {
    const data = emptyReportData();
    data.pureLaughMessages = 42;
    data.repeatedPhrases = [{ label: "반가워", count: 5, peakDate: "2026-01-02" }];
    data.llmInsights = {
      insideJokes: [{ label: "테스트 밈", whyFunny: "웃긴 상황", evidenceKeywords: [] }],
    };
    const html = renderRoomCultureStrip(data);
    assert.match(html, /id="s-culture"/);
    assert.match(html, /반가워/);
    assert.match(html, /테스트 밈/);
    assert.match(html, /42/);
  });

  it("renderActivityRestRhythm renders active/rest strip", () => {
    const data = emptyReportData();
    data.daily = [
      { date: "2026-01-01", count: 10 },
      { date: "2026-01-02", count: 12 },
      { date: "2026-01-04", count: 5 },
      { date: "2026-01-07", count: 8 },
    ];
    data.summary.longestActiveStreakDays = 2;
    data.insights.maxSilenceBetweenActiveDays = 2;
    const html = renderActivityRestRhythm(data);
    assert.match(html, /id="s-activity-rest"/);
    assert.match(html, /arr-seg--active/);
    assert.match(html, /arr-seg--gap/);
    assert.match(html, /최장 활동 연속/);
  });

  it("renderChemistryCards shows initiator, balance and total replies", () => {
    const interaction = {
      aliases: ["Alice", "Bob", "Carol"],
      matrix: [
        [0, 12, 3],
        [5, 0, 2],
        [1, 0, 0],
      ],
      topPairs: [
        { fromAlias: "Alice", toAlias: "Bob", replies: 12 },
        { fromAlias: "Bob", toAlias: "Alice", replies: 5 },
      ],
      totalReplies: 23,
    };
    const html = renderChemistryCards(interaction);
    assert.match(html, /Alice ↔ Bob/);
    assert.match(html, /주도/);
    assert.match(html, /밸런스/);
    assert.match(html, /17회/);
  });

  it("renderReportHtml includes all next-innovation sections", () => {
    const data = emptyReportData();
    data.summary.totalMessages = 100;
    data.summary.activeDays = 4;
    data.summary.longestActiveStreakDays = 2;
    data.insights.rhythmScore = 72;
    data.insights.burstGapUnder1mPercent = 35;
    data.insights.gapOver60mPercent = 20;
    data.conversationPace = { label: "빠른 왕복", emoji: "💨", detail: "test" };
    data.daily = [
      { date: "2026-01-01", count: 10 },
      { date: "2026-01-02", count: 12 },
      { date: "2026-01-04", count: 5 },
      { date: "2026-01-07", count: 8 },
    ];
    data.dailySentiment = [
      { date: "2026-01-01", positive: 30, negative: 10, neutral: 60, energy: 20 },
      { date: "2026-01-02", positive: 50, negative: 5, neutral: 45, energy: 45 },
      { date: "2026-01-03", positive: 20, negative: 30, neutral: 50, energy: -10 },
    ];
    data.repeatedPhrases = [{ label: "ㅎㅇ", count: 5, peakDate: "2026-01-01" }];
    data.pureLaughMessages = 7;
    data.interaction = {
      aliases: ["Alice", "Bob"],
      matrix: [
        [0, 12],
        [5, 0],
      ],
      topPairs: [{ fromAlias: "Alice", toAlias: "Bob", replies: 12 }],
      totalReplies: 17,
    };

    const html = renderReportHtml(data);
    assert.match(html, /class="kca-hero-rhythm"/);
    assert.match(html, /id="s-sentiment-weather"/);
    assert.match(html, /id="s-activity-rest"/);
    assert.match(html, /id="s-culture"/);
    assert.match(html, /chemistry-card/);
    assert.match(html, /72/);
    assert.match(html, /감정 날씨/);
    assert.match(html, /활동·휴식 리듬/);
  });
});
