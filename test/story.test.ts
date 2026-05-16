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
  lexicalTypeRichnessPercent: 22,
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
    burstDays: [{ date: "2026-05-01", count: 50 }],
    activityArc: [
      { id: "head", label: "처음 7일", messages: 80, activeDays: 2 },
      { id: "tail", label: "마지막 7일", messages: 20, activeDays: 1 },
      { id: "whole", label: "전체", messages: 100, activeDays: 3 },
    ],
    conversationPace: { label: "혼합 리듬", emoji: "🌊", detail: "테스트" },
    roomPulse: [],
  });

  assert.ok(story.headline.includes("테스트방"));
  assert.ok(story.wrapped.length >= 5);
  assert.equal(story.wrapped[0]?.id, "intro");
  assert.equal(story.personas.length, 2);
  assert.ok(story.chapters.length >= 2);
  assert.ok(story.calendarWeeks.length > 0);
  assert.equal(story.calendarTotalMessages, 100);
  assert.ok(story.calendarMonthLabels.some((m) => m.label === "5월"));
  assert.ok(story.calendarWeeks.length >= 3 && story.calendarWeeks.length <= 53);
  assert.match(story.calendarSpanLabel, /활동 \d+주/);
  assert.ok(story.tone.laughPer100 > 0);
});

test("buildReportStory limits duplicate persona titles", () => {
  const many: ParticipantStat[] = Array.from({ length: 8 }, (_, i) => ({
    alias: `U${i}`,
    messages: 100 - i * 5,
    characters: 1000,
    averageLength: i % 2 === 0 ? 45 : 8,
    attachmentMessages: i === 2 ? 30 : 2,
    linkMessages: i === 3 ? 20 : 1,
    sharePercent: i === 0 ? 35 : 8,
    nightMessages: i === 1 ? 40 : i === 4 ? 5 : 12,
    maxConsecutive: i === 5 ? 15 : 4,
  }));
  const story = buildReportStory({
    chatRoomName: "다양성",
    totalMessages: 800,
    activeDays: 10,
    firstMessage: "2026-04-01 09:00:00",
    lastMessage: "2026-05-01 22:00:00",
    longestStreak: 3,
    peakHour: 14,
    busiestWeekdayLabel: "월요일",
    nightSharePercent: 15,
    emojiMessages: 10,
    participants: many,
    daily: [{ date: "2026-04-01", count: 80 }],
    dailySenderCounts: new Map(),
    senderAliases: new Map(),
    insights: baseInsights,
    laughMessages: 50,
    shortMessages: 40,
    laughBySender: new Map(many.map((p, i) => [p.alias, i === 6 ? 25 : 2])),
    shortBySender: new Map(many.map((p, i) => [p.alias, i === 7 ? 30 : 3])),
    burstDays: [],
    activityArc: [],
    conversationPace: { label: "혼합", emoji: "🌊", detail: "" },
    roomPulse: [],
  });
  const titles = story.personas.map((p) => p.title);
  const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
  assert.ok(dup.length <= 2, `too many duplicate personas: ${dup.join(", ")}`);
});

test("buildReportStory uses Korean compact stats not k suffix", () => {
  const story = buildReportStory({
    chatRoomName: "대형방",
    totalMessages: 446_166,
    activeDays: 30,
    firstMessage: "2026-04-14 09:00:00",
    lastMessage: "2026-05-16 22:00:00",
    longestStreak: 5,
    peakHour: 21,
    busiestWeekdayLabel: "토요일",
    nightSharePercent: 10,
    emojiMessages: 100,
    participants,
    daily: [{ date: "2026-05-01", count: 446_166 }],
    dailySenderCounts: new Map(),
    senderAliases: new Map(),
    insights: baseInsights,
    laughMessages: 0,
    shortMessages: 0,
    laughBySender: new Map(),
    shortBySender: new Map(),
    burstDays: [],
    activityArc: [],
    conversationPace: { label: "혼합", emoji: "🌊", detail: "" },
    roomPulse: [],
  });
  const intro = story.wrapped.find((c) => c.id === "intro");
  assert.equal(intro?.stat, "44.6만");
  assert.ok(!story.wrapped.some((c) => /k\b/i.test(c.stat)));
});
