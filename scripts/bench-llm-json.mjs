#!/usr/bin/env node
/**
 * LLM JSON 파싱·grammar fixture 벤치 (로컬 GGUF 불필요)
 *
 * Usage:
 *   npm run bench:llm-json
 *   KCA_LLM_MOCK=1 node scripts/bench-llm-json.mjs --live-mock
 */
import { performance } from "node:perf_hooks";
import { parseLlmJsonResponse } from "../dist/src/llm-json.js";
import { buildKcaLlmJsonSchema } from "../dist/src/llm-schema.js";
import { isLlmGrammarEnabled } from "../dist/src/llm-grammar.js";
import { applyLlmEnrichment } from "../dist/src/llm-summarize.js";
import { emptyReportData } from "../dist/src/report-empty.js";

const FIXTURES = [
  {
    name: "bare-json",
    raw: '{"paragraphs":["첫 문단","둘째 문단"],"insightBullets":["참여 40명"]}',
    expect: true,
  },
  {
    name: "fence-json",
    raw: "```json\n{\"paragraphs\":[\"**강조**\",\"두\"],\"topicTitles\":[{\"i\":0,\"title\":\"주제\"}]}\n```",
    expect: true,
  },
  {
    name: "prose-only",
    raw: "서사만 한국어로 씁니다.",
    expect: false,
  },
  {
    name: "truncated",
    raw: '{"paragraphs":["미완',
    expect: false,
  },
];

function benchFixtures() {
  let ok = 0;
  for (const row of FIXTURES) {
    const parsed = parseLlmJsonResponse(row.raw, null);
    const pass = (parsed != null) === row.expect;
    if (pass) ok += 1;
    console.log(`${pass ? "✓" : "✗"} ${row.name} expect=${row.expect} got=${parsed != null}`);
  }
  const pct = Math.round((ok / FIXTURES.length) * 100);
  console.log(`\nfixture parse ${ok}/${FIXTURES.length} (${pct}%)`);
  return pct;
}

async function benchMockEnrichment() {
  const prevMock = process.env.KCA_LLM_MOCK;
  const prevLlm = process.env.KCA_LLM;
  process.env.KCA_LLM_MOCK = "1";
  process.env.KCA_LLM = "1";
  const t0 = performance.now();
  try {
    const result = await applyLlmEnrichment(emptyReportData(), { preset: "custom" }, 5000);
    const ms = Math.round(performance.now() - t0);
    console.log(`mock enrichment used=${result.used} in ${ms}ms`);
    return result.used;
  } finally {
    if (prevMock === undefined) delete process.env.KCA_LLM_MOCK;
    else process.env.KCA_LLM_MOCK = prevMock;
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
  }
}

async function main() {
  const liveMock = process.argv.includes("--live-mock");
  console.log(`bench:llm-json grammar=${isLlmGrammarEnabled() ? "on" : "off"}`);
  console.log(`schema keys: ${Object.keys(buildKcaLlmJsonSchema().properties ?? {}).join(", ")}`);
  const pct = benchFixtures();
  if (liveMock) {
    const used = await benchMockEnrichment();
    if (!used) process.exitCode = 1;
  }
  if (pct < 75) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
