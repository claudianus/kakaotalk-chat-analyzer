#!/usr/bin/env node
/**
 * 리포트 HTML 반응형 스모크 — 주요 뷰포트별 로컬 URL·체크리스트 출력
 * Usage:
 *   npm run build && node scripts/report-viewport-check.mjs [slug]
 *   npm run report:viewport -- [slug] --playwright
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, ".qa-reports");
const argv = process.argv.slice(2);
const playwrightMode = argv.includes("--playwright");
const slug = argv.find((a) => !a.startsWith("--")) || "smoke-ux";
const base = `http://127.0.0.1:18765/${encodeURIComponent(slug)}/`;
const htmlPath = join(outRoot, slug, "index.html");

const viewports = [
  { name: "mobile", w: 390, h: 844 },
  { name: "tablet", w: 834, h: 1194 },
  { name: "laptop", w: 1440, h: 900 },
  { name: "4k", w: 2560, h: 1440 },
];

const chartIds = ["chart-hours", "chart-kw-cloud", "chart-participants-chars"];

if (!existsSync(htmlPath)) {
  console.error(
    `missing ${htmlPath} — run: KCA_NO_SEMANTIC=1 node dist/src/cli.js test/fixtures/keyword-golden.csv --local -o .qa-reports/${slug}`,
  );
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const hasDeckNav = html.includes(".deck-nav");
const hasResponsive = html.includes("06-kca-responsive") || html.includes("kca-reveal");
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);

for (const id of chartIds) {
  if (!html.includes(`id="${id}"`)) {
    console.error(`[viewport] missing chart container #${id}`);
    process.exit(1);
  }
}

async function runPlaywright() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not installed — run: npm install");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.goto(base, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(500);
    for (const id of chartIds) {
      const canvas = await page.$(`#${id} canvas`);
      if (!canvas) failures.push(`#${id} missing canvas`);
    }
    const fatal = consoleErrors.filter(
      (t) =>
        !t.includes("CursorBrowser") &&
        !t.includes("favicon") &&
        (t.includes("bootDyadWhenVisible") || t.includes("[kca-chart]")),
    );
    if (fatal.length) failures.push(`console: ${fatal.join(" | ")}`);
    await page.close();
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error("report:viewport playwright FAIL:", failures.join("; "));
    process.exit(1);
  }
  console.log("report:viewport playwright OK (390px, charts + console)");
}

console.log(`report: ${htmlPath} (${kb} KiB)`);
console.log(`deck-nav in bundle: ${hasDeckNav}`);
console.log(`responsive layer: ${hasResponsive}`);
console.log(`chart containers: ${chartIds.join(", ")} OK`);
console.log("");
console.log("브라우저 DevTools 디바이스 모드 또는 창 크기로 확인:");
for (const v of viewports) {
  console.log(`  [${v.name}] ${v.w}×${v.h}  ${base}`);
}
console.log("");
console.log("체크: 가로 스크롤 없음 · ECharts 빈 캔버스 없음 · Wrapped 그리드 · fact 2열(모바일)");

if (playwrightMode) {
  await runPlaywright();
}
