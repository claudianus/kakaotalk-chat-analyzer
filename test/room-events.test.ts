import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildReportData } from "../src/analysis.js";
import { parseKakaoExport } from "../src/parser.js";
import {
  detectRoomEvent,
  detectSystemNotice,
  isSystemNoticeMessage,
} from "../src/system-notices.js";
import { renderReportHtml } from "../src/report.js";

test("detectSystemNotice matches join, leave, and deleted lines", () => {
  assert.equal(detectSystemNotice("홍길동님이 들어왔습니다."), "join");
  assert.equal(detectSystemNotice("철수님이 나갔습니다."), "leave");
  assert.equal(detectSystemNotice("들어왔습니다"), "join");
  assert.equal(detectSystemNotice("나갔습니다."), "leave");
  assert.equal(detectSystemNotice("메시지가 삭제되었습니다."), "deleted");
  assert.equal(detectSystemNotice("메시지가 삭제되었습니다"), "deleted");
  assert.equal(detectRoomEvent("메시지가 삭제되었습니다."), null);
  assert.equal(detectSystemNotice("회의 확인"), null);
});

test("system notices are excluded from keywords", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-room-"));
  const csvPath = join(dir, "chat.csv");
  await writeFile(
    csvPath,
    [
      "Date,User,Message",
      '2026-05-01 09:00:00,"Alice","안녕하세요"',
      '2026-05-01 09:01:00,"Bob","영희님이 들어왔습니다."',
      '2026-05-01 09:02:00,"Bob","철수님이 나갔습니다."',
      '2026-05-01 09:03:00,"Alice","메시지가 삭제되었습니다."',
      '2026-05-01 09:04:00,"Bob","들어왔습니다"',
    ].join("\n"),
    "utf8",
  );

  try {
    const parsed = await parseKakaoExport(csvPath);
    const data = buildReportData(parsed, { privacy: "public-masked" });
    assert.equal(data.summary.totalMessages, 5);
    assert.equal(data.roomEvents.joinCount, 2);
    assert.equal(data.roomEvents.leaveCount, 1);
    assert.equal(data.roomEvents.deletedCount, 1);
    assert.equal(data.roomEvents.total, 4);
    assert.equal(data.keywords.some((k) => k.label === "들어왔습니다"), false);
    assert.equal(data.keywords.some((k) => k.label === "나갔습니다"), false);
    assert.equal(data.keywords.some((k) => k.label === "삭제되었습니다"), false);
    assert.equal(data.keywords.some((k) => k.label === "메시지가"), false);

    const html = renderReportHtml(data);
    assert.equal(html.includes("카카오톡 시스템·운영 알림"), true);
    assert.equal(html.includes("메시지가 삭제되었습니다"), true);
    assert.equal(isSystemNoticeMessage("메시지가 삭제되었습니다."), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
