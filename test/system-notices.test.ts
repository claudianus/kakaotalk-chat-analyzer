import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSystemNoticeLine,
  splitMessageForAnalysis,
} from "../src/system-notices.js";

test("detectSystemNoticeLine covers moderation and open-chat templates", () => {
  assert.equal(detectSystemNoticeLine("관리자가 메시지를 가렸습니다."), "hidden");
  assert.equal(detectSystemNoticeLine("👍🎙️꾸꾸:우님을보냈습니다."), "kick");
  assert.equal(detectSystemNoticeLine("👍🎙️꾸꾸:우님을보냈습니다."), "kick");
  assert.equal(detectSystemNoticeLine("관리자만 말하기 기능이 활성화되었습니다."), "slowModeOn");
  assert.equal(detectSystemNoticeLine("🐥삐약이/운영진님이 부방장이 되었습니다."), "subManager");
  assert.equal(detectSystemNoticeLine("샵검색: #한국 코스피"), "shopSearch");
  assert.equal(detectSystemNoticeLine("사진 3장"), "photoBundle");
  assert.equal(detectSystemNoticeLine("선물과 메시지를 보냈습니다."), null);
});

test("splitMessageForAnalysis pulls embedded hidden tails from multiline CSV", () => {
  const split = splitMessageForAnalysis(
    '욕설 본문\n,"","관리자가 메시지를 가렸습니다."',
  );
  assert.equal(split.userText.includes("욕설"), true);
  assert.equal(split.notices.includes("hidden"), true);
  assert.equal(split.notices.includes("deleted"), false);
});

test("pure deleted line stays deleted", () => {
  const split = splitMessageForAnalysis("메시지가 삭제되었습니다.");
  assert.equal(split.userText, "");
  assert.deepEqual(split.notices, ["deleted"]);
});
