#!/usr/bin/env node
/**
 * 리포트 HTML 반응형 스모크 — 주요 뷰포트별 로컬 URL·체크리스트 출력
 * Usage: npm run build && node scripts/report-viewport-check.mjs [slug]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, ".qa-reports");
const slug = process.argv[2] || "smoke-ux";
const base = `http://127.0.0.1:18765/${encodeURIComponent(slug)}/`;
const htmlPath = join(outRoot, slug, "index.html");

const viewports = [
  { name: "mobile", w: 390, h: 844 },
  { name: "tablet", w: 834, h: 1194 },
  { name: "laptop", w: 1440, h: 900 },
  { name: "4k", w: 2560, h: 1440 },
];

if (!existsSync(htmlPath)) {
  console.error(`missing ${htmlPath} — run: KCA_NO_SEMANTIC=1 node dist/src/cli.js test/fixtures/keyword-golden.csv --local -o .qa-reports/${slug}`);
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const hasDeckNav = html.includes(".deck-nav");
const hasResponsive = html.includes("06-kca-responsive") || html.includes("kca-reveal");
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);

console.log(`report: ${htmlPath} (${kb} KiB)`);
console.log(`deck-nav in bundle: ${hasDeckNav}`);
console.log(`responsive layer: ${hasResponsive}`);
console.log("");
console.log("브라우저 DevTools 디바이스 모드 또는 창 크기로 확인:");
for (const v of viewports) {
  console.log(`  [${v.name}] ${v.w}×${v.h}  ${base}`);
}
console.log("");
console.log("체크: 가로 스크롤 없음 · ECharts 빈 캔버스 없음 · Wrapped 그리드 · fact 2열(모바일)");
