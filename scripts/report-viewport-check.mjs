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
  { name: "qhd", w: 2560, h: 1440 },
  { name: "ultrawide", w: 3440, h: 1440 },
  { name: "4k", w: 3840, h: 2160 },
];

const chartIds = ["chart-hours", "chart-kw-cloud"];

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
    for (const viewport of viewports) {
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width: viewport.w, height: viewport.h } });
        const consoleErrors = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        await page.goto(base, { waitUntil: "networkidle", timeout: 90_000 });
        await page.evaluate((mode) => {
          document.documentElement.setAttribute("data-theme", mode);
        }, theme);
        await page.waitForTimeout(700);

        const metrics = await page.evaluate(() => {
          const minSectionWidth = Math.min(
            ...Array.from(document.querySelectorAll(".kca-section, .kca-section-cluster"))
              .filter((el) => el.getBoundingClientRect().height > 20)
              .map((el) => Math.round(el.getBoundingClientRect().width)),
          );
          const missingAnchors = Array.from(document.querySelectorAll("[data-kca-jump]"))
            .map((el) => el.getAttribute("data-kca-jump"))
            .filter((id) => id && !document.getElementById(id));
          const failedCharts = Array.from(document.querySelectorAll(".chart-box[data-chart-failed='1']"))
            .map((el) => el.id || "(anonymous)");
          const emptyCharts = Array.from(document.querySelectorAll(".chart-box[data-chart-empty='1']"))
            .map((el) => el.id || "(anonymous)");
          const chartWidths = Array.from(document.querySelectorAll(".chart-box"))
            .map((el) => ({ id: el.id, width: Math.round(el.getBoundingClientRect().width) }));
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            mainWidth: Math.round(document.querySelector("main")?.getBoundingClientRect().width || 0),
            minSectionWidth: Number.isFinite(minSectionWidth) ? minSectionWidth : 0,
            missingAnchors,
            failedCharts,
            emptyCharts,
            chartWidths,
          };
        });

        const label = `${viewport.name}/${theme}`;
        if (metrics.scrollWidth > metrics.clientWidth + 2) {
          failures.push(`${label} horizontal overflow ${metrics.scrollWidth}>${metrics.clientWidth}`);
        }
        if (viewport.w >= 1600) {
          const expectedWideCanvas = Math.round(
            Math.min(metrics.clientWidth - 48, Math.max(1440, Math.min(metrics.clientWidth * 0.86, 2320))),
          );
          if (metrics.mainWidth < expectedWideCanvas - 12) {
            failures.push(`${label} main too narrow ${metrics.mainWidth}px for ${metrics.clientWidth}px viewport`);
          }
        }
        const minExpected = Math.min(320, viewport.w - 32);
        if (metrics.minSectionWidth > 0 && metrics.minSectionWidth < minExpected) {
          failures.push(`${label} section too narrow ${metrics.minSectionWidth}px`);
        }
        if (metrics.missingAnchors.length) {
          failures.push(`${label} missing anchors: ${metrics.missingAnchors.join(", ")}`);
        }
        if (metrics.failedCharts.length) {
          failures.push(`${label} failed charts: ${metrics.failedCharts.join(", ")}`);
        }
        const narrowCharts = metrics.chartWidths.filter((c) => c.width > 0 && c.width < 180);
        if (narrowCharts.length) {
          failures.push(`${label} narrow charts: ${narrowCharts.map((c) => `${c.id}:${c.width}`).join(", ")}`);
        }
        if (viewport.name !== "mobile" && metrics.emptyCharts.includes("chart-hours")) {
          failures.push(`${label} chart-hours unexpectedly empty`);
        }

        const fatal = consoleErrors.filter(
          (t) =>
            !t.includes("CursorBrowser") &&
            !t.includes("favicon") &&
            (t.includes("bootDyadWhenVisible") || t.includes("[kca-chart]")),
        );
        if (fatal.length) failures.push(`${label} console: ${fatal.join(" | ")}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error("report:viewport playwright FAIL:", failures.join("; "));
    process.exit(1);
  }
  console.log("report:viewport playwright OK (viewport matrix, wide canvas, anchors, overflow, charts + console)");
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
console.log("체크: 가로 스크롤 없음 · 큰 화면 full-width 캔버스 · ECharts 빈 캔버스 없음 · Wrapped 그리드 · fact 2열(모바일)");

if (playwrightMode) {
  await runPlaywright();
}
