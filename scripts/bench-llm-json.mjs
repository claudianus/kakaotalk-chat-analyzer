#!/usr/bin/env node
/**
 * LLM JSON·하네스·mock 매트릭스 벤치 (GGUF 불필요)
 *
 * Usage:
 *   npm run bench:llm-json
 *   npm run bench:llm-json -- --verbose
 *   npm run bench:llm-json -- --harness-only
 */
import { performance } from "node:perf_hooks";
import { parseLlmJsonResponse } from "../dist/src/llm-json.js";
import { buildKcaLlmJsonSchema } from "../dist/src/llm-schema.js";
import { isLlmGrammarEnabled } from "../dist/src/llm-grammar.js";
import { resolveLlmContextSize, resolveLlmMaxTokens } from "../dist/src/llm-llama-core.js";
import { runLlmHarness } from "../dist/src/llm-harness.js";
import { emptyReportData } from "../dist/src/report-empty.js";
import { resetLlmMockCallIndex } from "../dist/src/llm-mock.js";

const JSON_CASES = [
  {
    name: "bare-minimal",
    raw: '{"paragraphs":["첫 문단","둘째 문단"],"insightBullets":["참여 40명"]}',
    expect: true,
  },
  {
    name: "fence-with-prefix",
    raw: '다음은 JSON입니다.\n```json\n{"paragraphs":["**강조**","두"]}\n```',
    expect: true,
  },
  {
    name: "trailing-comma-repair",
    raw: '{"paragraphs":["첫","둘"],}',
    expect: true,
  },
  {
    name: "truncated-unrecoverable",
    raw: "not-even-brace",
    expect: false,
  },
  {
    name: "truncated-repaired",
    raw: '{"paragraphs":["첫","둘째',
    expect: true,
  },
  {
    name: "prose-only",
    raw: "서사만 한국어로 씁니다.",
    expect: false,
  },
  {
    name: "full-deck",
    raw: JSON.stringify({
      paragraphs: ["**클로드**", "코덱스"],
      roomArchetype: { name: "AI", description: "클로드", traits: ["개발"] },
    }),
    expect: true,
  },
];

const HARNESS_CASES = [
  { name: "valid-primary", mock: "valid", size: "0.8B", used: true },
  { name: "invalid-then-valid", mock: "sequence:invalid,valid", size: "0.8B", used: true },
  { name: "validation-then-valid", mock: "sequence:validation_fail,valid", size: "0.8B", used: true },
  { name: "timeout-then-valid", mock: "sequence:timeout,valid", size: "0.8B", used: true },
  { name: "all-invalid", mock: "invalid", size: "0.8B", used: false },
  {
    name: "4b-downgrade-ladder",
    mock: "sequence:invalid,invalid,invalid,valid",
    size: "4B",
    used: true,
  },
];

const verbose = process.argv.includes("--verbose");
const harnessOnly = process.argv.includes("--harness-only");

function log(msg) {
  if (verbose) console.log(msg);
}

function benchJsonParse() {
  let ok = 0;
  for (const row of JSON_CASES) {
    const parsed = parseLlmJsonResponse(row.raw, null);
    const pass = (parsed != null) === row.expect;
    if (pass) ok += 1;
    console.log(`${pass ? "✓" : "✗"} json/${row.name} expect=${row.expect} got=${parsed != null}`);
  }
  const pct = Math.round((ok / JSON_CASES.length) * 100);
  console.log(`json parse: ${ok}/${JSON_CASES.length} (${pct}%)\n`);
  return { ok, total: JSON_CASES.length, pct };
}

async function benchHarness() {
  let ok = 0;
  const prevLlm = process.env.KCA_LLM;
  process.env.KCA_LLM = "1";
  try {
    for (const row of HARNESS_CASES) {
      process.env.KCA_LLM_MOCK = row.mock;
      resetLlmMockCallIndex();
      const t0 = performance.now();
      const result = await runLlmHarness(emptyReportData(), {
        enabled: true,
        size: row.size,
        reason: "bench",
        timeoutMs: 45_000,
      });
      const ms = Math.round(performance.now() - t0);
      const pass = result.used === row.used;
      if (pass) ok += 1;
      const attempts =
        result.llmQuality?.attempts?.map((a) => `${a.label}:${a.ok ? "ok" : a.code}`).join(" → ") ??
        "—";
      console.log(
        `${pass ? "✓" : "✗"} harness/${row.name} used=${result.used} (${ms}ms) ${attempts}`,
      );
      log(`  skip=${result.skipReason ?? "—"}`);
    }
  } finally {
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
    delete process.env.KCA_LLM_MOCK;
  }
  const pct = Math.round((ok / HARNESS_CASES.length) * 100);
  console.log(`\nharness: ${ok}/${HARNESS_CASES.length} (${pct}%)`);
  return { ok, total: HARNESS_CASES.length, pct };
}

async function main() {
  console.log("bench:llm-json matrix");
  console.log(`grammar=${isLlmGrammarEnabled() ? "on" : "off"}`);
  console.log(`maxTokens=${resolveLlmMaxTokens()} context=${resolveLlmContextSize()}`);
  console.log(`schema keys: ${Object.keys(buildKcaLlmJsonSchema().properties ?? {}).length}\n`);

  let jsonRes = { ok: 0, total: 0, pct: 100 };
  let harnessRes = { ok: 0, total: 0, pct: 100 };

  if (!harnessOnly) {
    jsonRes = benchJsonParse();
  }
  harnessRes = await benchHarness();

  const allOk = jsonRes.ok + harnessRes.ok;
  const allTotal = jsonRes.total + harnessRes.total;
  console.log(`\nTOTAL ${allOk}/${allTotal}`);

  if (jsonRes.pct < 100 || harnessRes.pct < 100) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
