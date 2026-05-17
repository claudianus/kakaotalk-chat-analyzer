import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBenchmarkBandsFromValues } from "../src/benchmark-bands.js";
import { buildPeriodCompare } from "../src/period-compare.js";
import { buildRoomNarrative } from "../src/room-narrative.js";
import { emptyReportData } from "../src/report-empty.js";
import { renderReportHtml } from "../src/report.js";

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
