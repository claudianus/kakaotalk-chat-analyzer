import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_IDLE_MS, SessionGapStats } from "../src/gap-stats.js";

test("SessionGapStats splits on 30min idle", () => {
  const stats = new SessionGapStats();
  const t0 = Date.UTC(2024, 5, 1, 10, 0, 0);
  stats.addMessage(t0);
  stats.addMessage(t0 + 60_000);
  stats.addMessage(t0 + 60_000 + SESSION_IDLE_MS + 1);
  stats.addMessage(t0 + 60_000 + SESSION_IDLE_MS + 120_000);
  const snap = stats.finalize();
  assert.equal(snap.sessionCount, 2);
  assert.equal(snap.avgMessagesPerSession, 2);
  assert.ok(snap.medianSessionMinutes !== null);
});
