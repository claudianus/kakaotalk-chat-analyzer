#!/usr/bin/env node
/**
 * 키워드 회귀 감사: 상위 N개에 기대 토큰이 있는지 검사
 * Usage: npm run keyword:audit -- [fixture.csv]
 */
import { buildReportFromExportSync } from "../dist/src/analysis.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const defaultFixture = join(process.cwd(), "test", "fixtures", "keyword-golden.csv");
const csvPath = process.argv[2] || defaultFixture;
const MUST_INCLUDE = ["클로드", "코덱스"];

const report = await buildReportFromExportSync(csvPath, { progress: false, worker: false });
const top = report.keywords.slice(0, 30).map((k) => k.label);
let failed = false;

for (const need of MUST_INCLUDE) {
  const hit = top.some((l) => l.includes(need));
  if (!hit) {
    console.error(`FAIL: top30 missing "${need}"`);
    failed = true;
  }
}

console.log(`messages: ${report.summary.totalMessages} · topics: ${report.topics.length}`);
console.log("top15:", top.slice(0, 15).join(", "));
if (failed) process.exit(1);
console.log("keyword:audit OK");
