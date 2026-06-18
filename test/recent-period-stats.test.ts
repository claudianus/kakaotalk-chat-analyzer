import assert from "node:assert/strict";
import test from "node:test";
import { buildRecentPeriodInsights } from "../src/recent-period-stats.js";
import type { RecentSnapshot } from "../src/types.js";

function makeSnapshot(): RecentSnapshot {
  return {
    lastDate: "2025-06-07",
    reportDay: "2025-06-07",
    weekTotal: 70,
    weekVsOverall: 1.2,
    weekParticipants: 3,
    weekKeywords: ["점심", "회의"],
    today: null,
    week: [
      {
        date: "2025-06-01",
        messageCount: 10,
        activeParticipants: 2,
        topSenders: [{ alias: "A", count: 6 }],
        keywords: ["점심"],
        sentiment: { positive: 50, negative: 10, neutral: 40 },
        hourly: Array(24).fill(0),
        peakHour: 12,
        vsAvg: 1,
      },
      {
        date: "2025-06-07",
        messageCount: 60,
        activeParticipants: 3,
        topSenders: [{ alias: "B", count: 40 }],
        keywords: ["회의"],
        sentiment: { positive: 40, negative: 20, neutral: 40 },
        hourly: Array.from({ length: 24 }, (_, h) => (h === 23 ? 30 : 0)),
        peakHour: 23,
        vsAvg: 2,
      },
    ],
  };
}

test("buildRecentPeriodInsights aggregates week senders and metrics", () => {
  const snap = makeSnapshot();
  const dailySenderCounts = new Map<string, Map<string, number>>([
    ["2025-06-01", new Map([["rawA", 6], ["rawB", 4]])],
    ["2025-06-07", new Map([["rawA", 10], ["rawB", 40], ["rawC", 10]])],
  ]);
  const dailyHourly = new Map<string, number[]>([
    ["2025-06-01", Array(24).fill(0)],
    ["2025-06-07", Array.from({ length: 24 }, (_, h) => (h === 23 ? 30 : 0))],
  ]);
  const daily = new Map([
    ["2025-06-01", 10],
    ["2025-06-07", 60],
  ]);
  const aliases = new Map([
    ["rawA", "A"],
    ["rawB", "B"],
    ["rawC", "C"],
  ]);

  const out = buildRecentPeriodInsights({
    recentSnapshot: snap,
    dailySenderCounts,
    dailyHourly,
    daily,
    aliases,
    whole: {
      top3ParticipantSharePercent: 55,
      participantGini: 0.5,
      weekendSharePercent: 20,
      nightSharePercent: 15,
      avgDailyMessages: 8,
      participants: 5,
      totalMessages: 200,
    },
  });

  assert.equal(out.weekTopSenders[0]?.alias, "B");
  assert.equal(out.weekTopSenders[0]?.count, 44);
  assert.ok(out.metrics.some((m) => m.key === "top3" && m.week.endsWith("%")));
  assert.ok(out.metrics.some((m) => m.key === "night" && Number.parseFloat(m.week) > 0));
});
