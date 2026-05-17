#!/usr/bin/env node
/**
 * 키워드 회귀 감사: 상위 N개에 기대 토큰이 있는지 검사
 * Usage: npm run keyword:audit -- [fixture.csv]
 *   (인자 없으면 golden + vibecoding 샘플 모두 실행)
 */
import { buildReportFromExportSync } from "../dist/src/analysis.js";
import { isDiscourseTerm } from "../dist/src/discourse-lexicon.js";
import { join } from "node:path";

const MUST_NOT_IN_TOP20 = [
  "요즘",
  "시간",
  "부탁",
  "환영",
  "한데",
  "있어요",
  "그런거",
  "감사합니다",
];

const FIXTURES = [
  {
    name: "keyword-golden",
    path: join(process.cwd(), "test", "fixtures", "keyword-golden.csv"),
    mustInclude: ["클로드", "코덱스"],
  },
  {
    name: "vibecoding-room-sample",
    path: join(process.cwd(), "test", "fixtures", "vibecoding-room-sample.csv"),
    mustInclude: ["클로드", "코덱스", "playwright"],
  },
];

async function auditOne({ name, path, mustInclude }) {
  const report = await buildReportFromExportSync(path, { progress: false, worker: false });
  const top = report.keywords.slice(0, 30).map((k) => k.label);
  const top20 = top.slice(0, 20);
  let failed = false;

  for (const need of mustInclude) {
    const hit = top.some((l) => l.includes(need) || l.toLowerCase() === need.toLowerCase());
    if (!hit) {
      console.error(`[${name}] FAIL: top30 missing "${need}"`);
      failed = true;
    }
  }

  for (const banned of MUST_NOT_IN_TOP20) {
    if (top20.includes(banned)) {
      console.error(`[${name}] FAIL: top20 contains discourse noise "${banned}"`);
      failed = true;
    }
  }

  const discourseInTop20 = top20.filter((l) => isDiscourseTerm(l));
  if (discourseInTop20.length > 0) {
    console.error(`[${name}] FAIL: top20 discourse terms: ${discourseInTop20.join(", ")}`);
    failed = true;
  }

  console.log(`[${name}] messages: ${report.summary.totalMessages} · topics: ${report.topics.length}`);
  console.log(`[${name}] top15:`, top.slice(0, 15).join(", "));
  return failed;
}

const argPath = process.argv[2];
const targets = argPath
  ? [{ name: argPath, path: argPath, mustInclude: ["클로드", "코덱스"] }]
  : FIXTURES;

let anyFailed = false;
for (const fixture of targets) {
  if (await auditOne(fixture)) anyFailed = true;
}

if (anyFailed) process.exit(1);
console.log("keyword:audit OK");
