import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeLlmDeck } from "../src/llm-deck-validate.js";
import { emptyReportData } from "../src/report-empty.js";

test("sanitizeLlmDeck drops moments without stat evidence", () => {
  const data = emptyReportData();
  data.summary.totalMessages = 1200;
  data.highlights = ["총 1200건의 메시지"];
  const out = sanitizeLlmDeck(
    {
      moments: [
        { headline: "ok", statRef: "1200" },
        { headline: "bad", statRef: "없는숫자99999" },
      ],
    },
    data,
  );
  assert.equal(out.moments?.length, 1);
  assert.equal(out.moments?.[0]?.statRef, "1200");
});

test("sanitizeLlmDeck filters insideJokes evidence to keywords", () => {
  const data = emptyReportData();
  data.keywords = [{ label: "클로드", count: 10 }];
  const out = sanitizeLlmDeck(
    {
      insideJokes: [
        { label: "밈", whyFunny: "fun", evidenceKeywords: ["클로드", "없는단어"] },
      ],
    },
    data,
  );
  assert.equal(out.insideJokes?.length, 1);
  assert.deepEqual(out.insideJokes?.[0]?.evidenceKeywords, ["클로드"]);
});

test("sanitizeLlmDeck accepts decimal statRef tokens", () => {
  const data = emptyReportData();
  data.insights.top3ParticipantSharePercent = 36.9;
  const out = sanitizeLlmDeck(
    {
      moments: [
        { headline: "ok", statRef: "상위3 36.9%" },
        { headline: "bad", statRef: "99.9%" },
      ],
    },
    data,
  );
  assert.equal(out.moments?.length, 1);
});

test("sanitizeLlmDeck keeps roomArchetype when valid", () => {
  const data = emptyReportData();
  const out = sanitizeLlmDeck(
    {
      roomArchetype: {
        name: "야근 크루",
        description: "밤에 몰리는 대화",
        traits: ["심야", "개발"],
      },
    },
    data,
  );
  assert.equal(out.roomArchetype?.name, "야근 크루");
  assert.equal(out.roomArchetype?.traits.length, 2);
});
