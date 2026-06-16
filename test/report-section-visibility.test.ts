import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyReportData } from "../src/report-empty.js";
import {
  hasDaypartFingerprint,
  hasParticipantDynamics,
  hasRhythmSilenceMap,
  hasSentimentRollercoaster,
  hasTopicFlow,
} from "../src/report-section-visibility.js";
import type { ReportData } from "../src/types.js";

function base(): ReportData {
  return emptyReportData();
}

describe("report-section-visibility", () => {
  it("hasSentimentRollercoaster requires at least 3 daily sentiment points", () => {
    const data = base();
    data.dailySentiment = [];
    assert.equal(hasSentimentRollercoaster(data), false);
    data.dailySentiment = [
      { date: "2026-01-01", positive: 30, negative: 10, neutral: 60, energy: 20 },
      { date: "2026-01-02", positive: 40, negative: 5, neutral: 55, energy: 35 },
    ];
    assert.equal(hasSentimentRollercoaster(data), false);
    data.dailySentiment.push({ date: "2026-01-03", positive: 25, negative: 15, neutral: 60, energy: 10 });
    assert.equal(hasSentimentRollercoaster(data), true);
  });

  it("hasRhythmSilenceMap requires at least 2 sessions", () => {
    const data = base();
    data.insights.sessionCount = 0;
    assert.equal(hasRhythmSilenceMap(data), false);
    data.insights.sessionCount = 1;
    assert.equal(hasRhythmSilenceMap(data), false);
    data.insights.sessionCount = 2;
    assert.equal(hasRhythmSilenceMap(data), true);
  });

  it("hasParticipantDynamics requires at least 2 participants", () => {
    const data = base();
    data.participants = [];
    assert.equal(hasParticipantDynamics(data), false);
    data.participants = [{ alias: "A", messages: 10, characters: 50, averageLength: 5, attachmentMessages: 0, linkMessages: 0, sharePercent: 100, characterSharePercent: 100, nightMessages: 0, maxConsecutive: 1 }];
    assert.equal(hasParticipantDynamics(data), false);
    data.participants.push({ alias: "B", messages: 5, characters: 25, averageLength: 5, attachmentMessages: 0, linkMessages: 0, sharePercent: 50, characterSharePercent: 50, nightMessages: 0, maxConsecutive: 1 });
    assert.equal(hasParticipantDynamics(data), true);
  });

  it("hasDaypartFingerprint requires non-zero hourly data", () => {
    const data = base();
    data.hourly = Array.from({ length: 24 }, () => 0);
    assert.equal(hasDaypartFingerprint(data), false);
    data.hourly[12] = 5;
    assert.equal(hasDaypartFingerprint(data), true);
  });

  it("hasTopicFlow requires smartTopicTrend items or multiple topics", () => {
    const data = base();
    data.smartTopicTrend = null;
    data.topics = [];
    assert.equal(hasTopicFlow(data), false);
    data.topics = [{ id: "t1", kind: "theme", title: "주제1", terms: ["a"], messagePercent: 10 }];
    assert.equal(hasTopicFlow(data), false);
    data.topics.push({ id: "t2", kind: "theme", title: "주제2", terms: ["b"], messagePercent: 5 });
    assert.equal(hasTopicFlow(data), true);
    data.topics = [];
    data.smartTopicTrend = { granularity: "daily", label: "일간", hint: "hint", items: [{ period: "2026-01-01", topics: [{ name: "a", value: 1 }] }] };
    assert.equal(hasTopicFlow(data), false);
    data.smartTopicTrend.items.push({ period: "2026-01-02", topics: [{ name: "b", value: 1 }] });
    assert.equal(hasTopicFlow(data), true);
  });
});
