#!/usr/bin/env node
/**
 * 시맨틱 임베딩 모델 벤치(속도·클러스터 수)
 *
 * Usage:
 *   npm run bench:semantic
 *   KCA_SEMANTIC_MODEL=Xenova/multilingual-e5-small npm run bench:semantic
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { extractSemanticKeywords } from "../dist/src/semantic-keywords.js";
import { semanticEmbeddingModelId } from "../dist/src/semantic-policy.js";
import { buildKeywordStopwords } from "../dist/src/keyword-stopwords.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "test/fixtures/keyword-golden.csv");

function loadSampleMessages(limit = 500): string[] {
  const raw = readFileSync(fixture, "utf8");
  const lines = raw.split(/\r?\n/).slice(1);
  const out = [];
  for (const line of lines) {
    const i = line.lastIndexOf(",");
    if (i < 0) continue;
    const msg = line.slice(i + 1).replace(/^"|"$/g, "").trim();
    if (msg.length >= 12) out.push(msg);
    if (out.length >= limit) break;
  }
  return out;
}

async function benchOne(label, buildOptions) {
  const messages = loadSampleMessages(Number(process.env.KCA_BENCH_SAMPLES ?? "500"));
  const modelId = semanticEmbeddingModelId(buildOptions);
  console.log(`\nbench:semantic [${label}] model=${modelId} samples=${messages.length}`);
  const t0 = performance.now();
  const items = await extractSemanticKeywords(messages, {
    stopwords: buildKeywordStopwords(),
    corpusMessages: messages.length,
    buildOptions,
    limit: 24,
  });
  const ms = Math.round(performance.now() - t0);
  console.log(`done ${ms}ms · clusters=${items.length}`);
  if (items.length) {
    console.log(
      "top:",
      items
        .slice(0, 8)
        .map((x) => `${x.label}(${x.messageHits})`)
        .join(", "),
    );
  }
  return { ms, clusters: items.length };
}

async function main() {
  if (process.env.KCA_BENCH_COMPARE === "1") {
    const balanced = await benchOne("balanced", undefined);
    const quality = await benchOne("quality", { preset: "quality" });
    console.log(
      `\ncompare: balanced ${balanced.ms}ms/${balanced.clusters}cl · quality ${quality.ms}ms/${quality.clusters}cl`,
    );
    return;
  }
  const preset = process.env.KCA_BENCH_PRESET === "quality" ? { preset: "quality" } : undefined;
  await benchOne(process.env.KCA_BENCH_PRESET ?? "balanced", preset);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
