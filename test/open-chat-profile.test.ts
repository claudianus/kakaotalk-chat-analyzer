import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { buildReportFromExportSync } from "../src/analysis.js";
import { inferOpenChatProfile } from "../src/open-chat-profile.js";

const OPEN_CHAT_FIXTURE = join(process.cwd(), "test/fixtures/open-chat-room.csv");

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

test("open-chat-room fixture yields join/leave signals", async () => {
  if (process.env.KCA_NO_KIWI === "1") return;

  const data = await buildReportFromExportSync(OPEN_CHAT_FIXTURE, {
    progress: false,
    semanticKeywords: false,
  });
  assert.ok(data.summary.totalMessages >= 4);
  assert.ok(data.openChatBoilerplateExcluded >= 1 || data.roomEvents.total >= 1);
});
