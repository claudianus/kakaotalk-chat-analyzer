import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEventSpine } from "../src/event-spine.js";

describe("buildEventSpine", () => {
  it("includes burst and silence resume events", () => {
    const events = buildEventSpine({
      burstDays: [{ date: "2024-06-01", count: 99 }],
      daily: [
        { date: "2024-05-01", count: 5 },
        { date: "2024-05-20", count: 3 },
        { date: "2024-06-01", count: 99 },
      ],
      roomPulse: [],
      repeatedPhrases: [],
      maxSilenceBetweenActiveDays: 10,
      dailyLinkSpikes: [],
      dailyPlanSignals: [],
    });
    assert.ok(events.some((e) => e.kind === "burst"));
    assert.ok(events.some((e) => e.kind === "silence"));
  });

  it("enriches sparse timelines with milestones", () => {
    const events = buildEventSpine({
      burstDays: [],
      daily: [
        { date: "2024-04-13", count: 10 },
        { date: "2024-05-16", count: 20 },
      ],
      roomPulse: [],
      repeatedPhrases: [],
      maxSilenceBetweenActiveDays: null,
      dailyLinkSpikes: [],
      dailyPlanSignals: [],
    });
    assert.ok(events.length >= 2);
    assert.ok(events.some((e) => e.kind === "milestone"));
  });

  it("uses phrase peakDate when provided for meme events", () => {
    const events = buildEventSpine({
      burstDays: [],
      daily: [
        { date: "2024-04-01", count: 2 },
        { date: "2024-04-15", count: 50 },
      ],
      roomPulse: [],
      repeatedPhrases: [{ label: "ㅋㅋ", count: 9, peakDate: "2024-04-01" }],
      maxSilenceBetweenActiveDays: null,
      dailyLinkSpikes: [],
      dailyPlanSignals: [],
    });
    const meme = events.find((e) => e.kind === "meme");
    assert.equal(meme?.date, "2024-04-01");
  });

  it("falls back to busiest day for meme without peakDate", () => {
    const events = buildEventSpine({
      burstDays: [],
      daily: [
        { date: "2024-04-01", count: 2 },
        { date: "2024-04-15", count: 50 },
      ],
      roomPulse: [],
      repeatedPhrases: [{ label: "ㅋㅋ", count: 9 }],
      maxSilenceBetweenActiveDays: null,
      dailyLinkSpikes: [],
      dailyPlanSignals: [],
    });
    const meme = events.find((e) => e.kind === "meme");
    assert.equal(meme?.date, "2024-04-15");
  });

  it("caps repetitive room pulse events while preserving variety", () => {
    const daily = Array.from({ length: 12 }, (_, i) => ({
      date: `2024-04-${String(i + 1).padStart(2, "0")}`,
      count: 100 + i,
    }));
    const events = buildEventSpine({
      burstDays: [],
      daily,
      roomPulse: daily.map((d) => ({ date: d.date, join: 10, leave: 5, hidden: 0, kick: 0, newSenders: 8 })),
      repeatedPhrases: [],
      maxSilenceBetweenActiveDays: null,
      dailyLinkSpikes: [],
      dailyPlanSignals: [],
    });
    assert.ok(events.filter((e) => e.kind === "room").length <= 4);
    assert.ok(events.filter((e) => e.kind === "newcomer").length <= 4);
    for (const d of daily.map((x) => x.date)) {
      assert.ok(events.filter((e) => e.date === d).length <= 2, `too many events on ${d}`);
    }
  });
});
