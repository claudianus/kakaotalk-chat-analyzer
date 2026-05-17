#!/usr/bin/env node
/**
 * preset별 리포트 생성 시간(수용: speed ≤3min, balanced ≤5min @ 90k 근사)
 *
 * Usage:
 *   npm run bench:preset
 *   KCA_BENCH_PRESET=speed npm run bench:preset
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { buildReportFromExport } from "../dist/src/analysis.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "test/fixtures/keyword-golden.csv");

const SLA_MS = {
  speed: 180_000,
  balanced: 300_000,
  quality: 360_000,
};

async function main() {
  const preset = process.env.KCA_BENCH_PRESET?.trim() || "balanced";
  const prevSemantic = process.env.KCA_NO_SEMANTIC;
  const prevSentiment = process.env.KCA_NO_SENTIMENT;
  const prevLlm = process.env.KCA_LLM;
  if (preset === "speed") {
    process.env.KCA_NO_SEMANTIC = "1";
    process.env.KCA_NO_SENTIMENT = "1";
  } else {
    delete process.env.KCA_NO_SEMANTIC;
    delete process.env.KCA_NO_SENTIMENT;
  }
  process.env.KCA_LLM = "0";

  const t0 = performance.now();
  try {
    await buildReportFromExport(fixture, {
      preset,
      local: true,
      semanticKeywords: preset !== "speed",
      sentiment: preset === "quality",
    });
  } finally {
    if (prevSemantic === undefined) delete process.env.KCA_NO_SEMANTIC;
    else process.env.KCA_NO_SEMANTIC = prevSemantic;
    if (prevSentiment === undefined) delete process.env.KCA_NO_SENTIMENT;
    else process.env.KCA_NO_SENTIMENT = prevSentiment;
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
  }

  const ms = Math.round(performance.now() - t0);
  const cap = SLA_MS[preset] ?? SLA_MS.balanced;
  const ok = ms <= cap;
  const corpusLines = readFileSync(fixture, "utf8").split(/\r?\n/).length - 1;
  console.log(`bench:preset preset=${preset} corpusLines≈${corpusLines} ms=${ms} cap=${cap} ${ok ? "PASS" : "FAIL"}`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
