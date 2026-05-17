import assert from "node:assert/strict";
import test from "node:test";
import { inferOpenChatProfile } from "../src/open-chat-profile.js";

test("inferOpenChatProfile flags high join/leave traffic", () => {
  const profile = inferOpenChatProfile(
    {
      joinCount: 80,
      leaveCount: 70,
      deletedCount: 0,
      hiddenCount: 0,
      kickCount: 0,
      slowModeOnCount: 0,
      slowModeOffCount: 0,
      subManagerCount: 0,
      managerCount: 0,
      shopSearchCount: 5,
      photoBundleCount: 0,
      total: 200,
      joinSharePercent: 8,
      leaveSharePercent: 7,
      deletedSharePercent: 0,
      hiddenSharePercent: 0,
      kickSharePercent: 0,
    },
    1000,
  );
  assert.equal(profile.likely, true);
  assert.ok(profile.joinLeaveSharePercent >= 14);
});
