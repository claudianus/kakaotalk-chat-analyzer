import assert from "node:assert/strict";
import test from "node:test";
import { buildReportStory } from "../src/story.js";
import type { ParticipantStat, ReportInsights } from "../src/types.js";

const baseInsights: ReportInsights = {
  weekendSharePercent: 22,
  participantGini: 0.28,
  replyGapP90Minutes: 45,
  maxSilenceBetweenActiveDays: 10,
  top3ParticipantSharePercent: 72,
  linkDomainEntropyBits: 1.2,
  densityMessagesPerCalendarDay: 12,
  questionLikeMessagesPer100: 8,
  speakerSwitchRatePer100: 42,
  rhythmScore: 71,
  daypartPercents: [],
  linksPer100: 5,
  attachmentsPer100: 12,
  medianMessagesPerParticipant: 40,
  burstGapUnder1mPercent: 38,
  gapOver60mPercent: 8,
  activeHoursCount: 14,
  keywordTop1SharePercent: 12,
  photoShareOfAllAttachmentMarkers: 55,
  monologueMessagesPercent: 18,
  peakDaySharePercent: 9,
  uniqueDomainCount: 3,
  replyGapCoeffVariation: 1.1,
};

const participants: ParticipantStat[] = [
  {
    alias: "A***e",
    messages: 60,
    characters: 2400,
    averageLength: 40,
    attachmentMessages: 12,
    linkMessages: 5,
    sharePercent: 60,
    nightMessages: 8,
    maxConsecutive: 7,
  },
  {
    alias: "B*b",
    messages: 40,
    characters: 800,
    averageLength: 20,
    attachmentMessages: 2,
    linkMessages: 1,
    sharePercent: 40,
    nightMessages: 2,
    maxConsecutive: 3,
  },
];

test("buildReportStory produces wrapped cards and headline", () => {
  const dailySender = new Map<string, Map<string, number>>();
  dailySender.set("2026-05-01", new Map([["Alice", 30], ["Bob", 20]]));
  dailySender.set("2026-05-02", new Map([["Alice", 20], ["Bob", 10]]));
  dailySender.set("2026-05-20", new Map([["Alice", 10], ["Bob", 10]]));

  const story = buildReportStory({
    chatRoomName: "테스트방",
    totalMessages: 100,
    activeDays: 3,
    firstMessage: "2026-05-01 09:00:00",
    lastMessage: "2026-05-20 22:00:00",
    longestStreak: 2,
    peakHour: 21,
    busiestWeekdayLabel: "금요일",
    nightSharePercent: 12,
    emojiMessages: 5,
    participants,
    daily: [
      { date: "2026-05-01", count: 50 },
      { date: "2026-05-02", count: 30 },
      { date: "2026-05-20", count: 20 },
    ],
    dailySenderCounts: dailySender,
    senderAliases: new Map([
      ["Alice", "A***e"],
      ["Bob", "B*b"],
    ]),
    insights: baseInsights,
    laughMessages: 15,
    shortMessages: 20,
    laughBySender: new Map([["A***e", 10], ["B*b", 2]]),
    shortBySender: new Map([["B*b", 12]]),
  });

  assert.ok(story.headline.includes("테스트방"));
  assert.ok(story.wrapped.length >= 5);
  assert.equal(story.wrapped[0]?.id, "intro");
  assert.equal(story.personas.length, 2);
  assert.ok(story.chapters.length >= 2);
  assert.ok(story.calendarWeeks.length > 0);
  assert.equal(story.calendarTotalMessages, 100);
  assert.ok(story.calendarMonthLabels.some((m) => m.label === "May"));
  assert.ok(story.tone.laughPer100 > 0);
});
