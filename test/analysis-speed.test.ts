import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { ReportAggregator } from "../src/aggregator.js";
import { phaseProfilingEnabled } from "../src/analysis-phase-profile.js";
import { resolveEmbedBatchSize, resolveSentimentBatchSize } from "../src/ml-batch-size.js";
import { resolveKiwiWorkerCount, kiwiWorkerPoolEnabled } from "../src/kiwi-worker-config.js";
import { keywordTokensForRecord } from "../src/keyword-record-tokens.js";
import type { ChatRecord } from "../src/types.js";

test("phaseProfilingEnabled respects KCA_PROFILE_PHASES", () => {
  const prev = process.env.KCA_PROFILE_PHASES;
  process.env.KCA_PROFILE_PHASES = "1";
  assert.equal(phaseProfilingEnabled(), true);
  delete process.env.KCA_PROFILE_PHASES;
  assert.equal(phaseProfilingEnabled(), false);
  if (prev === undefined) delete process.env.KCA_PROFILE_PHASES;
  else process.env.KCA_PROFILE_PHASES = prev;
});

test("resolveKiwiWorkerCount defaults to 1 when KCA_NO_KIWI_WORKERS", () => {
  const prev = process.env.KCA_NO_KIWI_WORKERS;
  process.env.KCA_NO_KIWI_WORKERS = "1";
  assert.equal(resolveKiwiWorkerCount(), 1);
  if (prev === undefined) delete process.env.KCA_NO_KIWI_WORKERS;
  else process.env.KCA_NO_KIWI_WORKERS = prev;
});

test("kiwiWorkerPoolEnabled requires 2000+ messages and workers>1", () => {
  assert.equal(kiwiWorkerPoolEnabled(4, 1999), false);
  assert.equal(kiwiWorkerPoolEnabled(1, 5000), false);
  assert.equal(kiwiWorkerPoolEnabled(4, 5000), true);
});

test("ml batch sizes honor env override", () => {
  const prevE = process.env.KCA_EMBED_BATCH;
  const prevS = process.env.KCA_SENTIMENT_BATCH;
  process.env.KCA_EMBED_BATCH = "48";
  process.env.KCA_SENTIMENT_BATCH = "32";
  assert.equal(resolveEmbedBatchSize(), 48);
  assert.equal(resolveSentimentBatchSize(), 32);
  if (prevE === undefined) delete process.env.KCA_EMBED_BATCH;
  else process.env.KCA_EMBED_BATCH = prevE;
  if (prevS === undefined) delete process.env.KCA_SENTIMENT_BATCH;
  else process.env.KCA_SENTIMENT_BATCH = prevS;
});

test("stats pass collectSamples fills semantic reservoir without keywords", () => {
  const record: ChatRecord = {
    line: 2,
    rawDate: "2026-05-01 10:00:00",
    sender: "A",
    message: "오늘 클로드 코덱스로 개발 중입니다 테스트 문장입니다",
    date: { year: 2026, month: 5, day: 1, hour: 10, minute: 0, second: 0 },
  };
  const agg = new ReportAggregator("x.csv", "public-masked", 30, {
    semanticSamples: true,
    sentimentSamples: true,
    estimatedMessages: 100,
  });
  agg.consume(record, { skipKeywords: true, collectSamples: true });
  const samples = agg.drainSemanticSamples();
  assert.ok(samples.length >= 1);
});

test("keywordTokensForRecord matches golden row shape", () => {
  const record: ChatRecord = {
    line: 2,
    rawDate: "2026-01-10 10:00:00",
    date: { year: 2026, month: 1, day: 10, hour: 10, minute: 0, second: 0 },
    sender: "A",
    message: "클로드 코덱스로 리팩터링 중",
  };
  const row = keywordTokensForRecord(record);
  assert.ok(row && row.tokens.length >= 1);
});
