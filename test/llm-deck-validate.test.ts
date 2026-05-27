import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeLlmDeck, sanitizeLlmParagraphs } from "../src/llm-deck-validate.js";
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

test("sanitizeLlmDeck replaces generic archetype failure with evidence-based fallback", () => {
  const data = emptyReportData();
  data.keywords = [
    { label: "클로드", count: 120 },
    { label: "코덱스", count: 100 },
    { label: "개발", count: 80 },
  ];
  data.topics = [
    { id: "t1", kind: "theme", title: "AI 코딩 도구", terms: ["클로드", "코덱스", "개발"], messagePercent: 32 },
  ];
  const out = sanitizeLlmDeck(
    {
      roomArchetype: {
        name: "Chatroom(이름 미전송)",
        description: "Messages are too general to define a specific archetype. More specific topic keywords are needed.",
        traits: ["General", "No focus", "Lack of keywords"],
      },
    },
    data,
  );
  assert.equal(out.roomArchetype?.name, "AI 코딩 실험실");
  assert.match(out.roomArchetype?.description ?? "", /클로드/);
  assert.deepEqual(out.roomArchetype?.traits.slice(0, 2), ["클로드", "코덱스"]);
});

test("sanitizeLlmParagraphs drops generic and failure prose without data evidence", () => {
  const data = emptyReportData();
  data.keywords = [{ label: "클로드", count: 120 }, { label: "코덱스", count: 100 }];
  const paras = sanitizeLlmParagraphs(
    [
      "Messages are too general to define a specific archetype.",
      "이 방은 여러 사람이 다양한 이야기를 나누는 공간입니다.",
      "클로드와 코덱스 이야기가 반복되며 AI 코딩 도구 흐름이 중심입니다.",
    ],
    data,
  );
  assert.deepEqual(paras, ["클로드와 코덱스 이야기가 반복되며 AI 코딩 도구 흐름이 중심입니다."]);
});
