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
});
