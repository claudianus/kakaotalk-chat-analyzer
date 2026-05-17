#!/usr/bin/env node
/**
 * 한국어 채팅 골든 문장 감정 벤치
 *
 * Usage:
 *   npm run bench:sentiment
 *   KCA_SENTIMENT_MODEL=Xenova/bert-base-multilingual-uncased-sentiment npm run bench:sentiment
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { analyzeSentimentBatch } from "../dist/src/sentiment-analyze.js";
import { sentimentModelId } from "../dist/src/sentiment-policy.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const goldenPath = join(root, "test/fixtures/sentiment-golden.json");

function loadGolden() {
  return JSON.parse(readFileSync(goldenPath, "utf8"));
}

async function main() {
  const rows = loadGolden();
  const texts = rows.map((r) => r.text);
  const modelId = sentimentModelId("quality");
  console.log(`bench:sentiment model=${modelId} n=${texts.length}`);
  const t0 = performance.now();
  const labels = await analyzeSentimentBatch(texts, undefined, { preset: "quality" });
  const ms = Math.round(performance.now() - t0);
  let match = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const got = labels[i];
    const ok = got === row.expect;
    if (ok) match += 1;
    console.log(`${ok ? "✓" : "✗"} ${row.expect.padEnd(8)} → ${got?.padEnd(8)}  ${row.text}`);
  }
  const pct = Math.round((match / rows.length) * 100);
  console.log(`\nmatch ${match}/${rows.length} (${pct}%) in ${ms}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
