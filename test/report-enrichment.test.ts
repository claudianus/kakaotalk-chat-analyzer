import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRoomPulse,
  computeActivityArc,
  computeBurstDays,
  computeConversationPace,
} from "../src/report-enrichment.js";
import type { ReportInsights } from "../src/types.js";

function baseInsights(over: Partial<ReportInsights> = {}): ReportInsights {
  return {
    weekendSharePercent: 0,
    participantGini: 0.5,
    replyGapP90Minutes: null,
    maxSilenceBetweenActiveDays: null,
    top3ParticipantSharePercent: 0,
    linkDomainEntropyBits: null,
    densityMessagesPerCalendarDay: null,
    questionLikeMessagesPer100: 0,
    speakerSwitchRatePer100: 50,
    rhythmScore: 50,
    daypartPercents: [],
    linksPer100: 0,
    attachmentsPer100: 0,
    medianMessagesPerParticipant: null,
    burstGapUnder1mPercent: 80,
    gapOver60mPercent: 5,
    activeHoursCount: 0,
    keywordTop1SharePercent: null,
    photoShareOfAllAttachmentMarkers: null,
    monologueMessagesPercent: 0,
    peakDaySharePercent: 0,
    uniqueDomainCount: 0,
    replyGapCoeffVariation: null,
    lexicalTypeRichnessPercent: null,
    ...over,
  };
}

test("computeBurstDays finds high-volume days in skewed chat", () => {
  const daily = [
    { date: "2026-04-01", count: 100 },
    { date: "2026-04-02", count: 120 },
    { date: "2026-04-03", count: 110 },
    { date: "2026-04-04", count: 400 },
    { date: "2026-04-05", count: 380 },
    { date: "2026-04-06", count: 105 },
  ];
  const burst = computeBurstDays(daily);
  assert.ok(burst.length >= 2);
  assert.equal(burst[0]!.date, "2026-04-04");
});

test("computeConversationPace labels realtime debate rooms", () => {
  const pace = computeConversationPace(
    baseInsights({ burstGapUnder1mPercent: 90, speakerSwitchRatePer100: 78 }),
  );
  assert.equal(pace.label, "실시간 토론장");
});

test("computeActivityArc compares head and tail windows", () => {
  const daily = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, "0")}`,
    count: i < 7 ? 50 : i >= 13 ? 200 : 80,
  }));
  const arc = computeActivityArc(daily);
  const head = arc.find((a) => a.id === "head");
  const tail = arc.find((a) => a.id === "tail");
  assert.ok(head && tail);
  assert.ok(tail.messages > head.messages);
});

test("buildRoomPulse aligns with activity dates", () => {
  const pulse = buildRoomPulse(
    ["2026-04-01", "2026-04-02"],
    new Map([["2026-04-01", 3]]),
    new Map(),
    new Map([["2026-04-02", 5]]),
    new Map(),
    new Map([["2026-04-01", 2]]),
  );
  assert.equal(pulse.length, 2);
  assert.equal(pulse[0]!.join, 3);
  assert.equal(pulse[0]!.newSenders, 2);
  assert.equal(pulse[1]!.hidden, 5);
});
