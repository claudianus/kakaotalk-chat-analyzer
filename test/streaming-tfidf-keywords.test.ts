import assert from "node:assert/strict";
import test from "node:test";
import { normalizeKoreanText } from "../src/korean-normalize.js";
import { StreamingTfidfKeywords } from "../src/streaming-tfidf-keywords.js";

test("normalizeKoreanText keeps hangul and collapses spaces", () => {
  const t = normalizeKoreanText("한글과  English 123  !!!", { keepEnglish: true, keepNumbers: true });
  assert.match(t, /한글과/);
  assert.match(t, /English/);
  assert.equal(t.includes("!!!"), false);
});

test("StreamingTfidfKeywords extracts topical terms from short corpus", () => {
  const docs = [
    "이재명 대통령 정책이 좋다고 생각합니다",
    "윤석열 전 대통령 관련 뉴스가 많아요",
    "민주당 지지자들이 모였습니다",
    "국민의힘 반대파도 토론했어요",
    "이재명 지지합니다 정말",
    "부정선거 이야기 또 나옴",
    "부정선거 관련 영상 공유",
  ];
  const kw = new StreamingTfidfKeywords();
  for (const d of docs) kw.addDocument(d);
  const items = kw.extractKeywordItems({ limit: 20, minDocFreq: 2 });
  const labels = items.map((i) => i.label);
  assert.ok(labels.some((w) => w.includes("이재명")));
  assert.ok(labels.some((w) => w.includes("부정") || w.includes("선거")));
  assert.equal(labels.includes("니다"), false);
  assert.equal(labels.includes("으로"), false);
});

test("StreamingTfidfKeywords sorts extract results by BM25 score first", () => {
  const kw = new StreamingTfidfKeywords();
  for (let i = 0; i < 200; i += 1) {
    kw.addDocument(`클로드 코덱스 개발 ${i}`);
  }
  for (let i = 0; i < 3; i += 1) {
    kw.addDocument("vendoritemid sourcetype mycoupang products");
  }
  const top = kw.extractKeywordItems({ limit: 15, minDocFreq: 2 });
  for (let i = 1; i < top.length; i += 1) {
    const prev = top[i - 1]!;
    const cur = top[i]!;
    assert.ok(
      prev.score >= cur.score ||
        (prev.score === cur.score && prev.messageHits >= cur.messageHits),
      `score order: ${prev.label}(${prev.score}) before ${cur.label}(${cur.score})`,
    );
  }
});

test("StreamingTfidfKeywords surfaces adjacent bigrams", () => {
  const docs = [
    "클로드 코덱스 쓰는 중",
    "클로드 코덱스 좋아요",
    "코덱스 설치했어",
    "클로드 질문",
  ];
  const kw = new StreamingTfidfKeywords();
  for (const d of docs) kw.addDocument(d);
  const labels = kw.extractKeywordItems({ limit: 12, minDocFreq: 2 }).map((i) => i.label);
  assert.ok(labels.some((w) => w === "클로드 코덱스" || (w.includes("클로드") && w.includes("코덱스"))));
});
