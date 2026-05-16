#!/usr/bin/env node
/**
 * Playwright로 리포트 HTML을 뷰포트별 full-page 스크린샷 (CI·로컬 QA)
 *
 * Usage:
 *   npm run build
 *   npm run report:qa:serve   # 다른 터미널
 *   npm run report:screenshots -- smoke-ux
 */
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2] || "smoke-ux";
const baseUrl =
  process.env.KCA_QA_BASE_URL || `http://127.0.0.1:18765/${encodeURIComponent(slug)}/`;
const outDir = join(root, ".qa-reports", slug, "screenshots");

const viewports = [
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-834", width: 834, height: 1194 },
  { name: "laptop-1440", width: 1440, height: 900 },
  { name: "4k-2560", width: 2560, height: 1440 },
];

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not installed — run: npm install");
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  try {
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      try {
        await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
        await page.waitForSelector(".chart-box canvas", { timeout: 15_000 }).catch(() => {});
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
        const path = join(outDir, `${vp.name}.png`);
        await page.screenshot({ path, fullPage: true });
        console.log(`screenshot: ${path} (${vp.width}×${vp.height})`);
        const fatal = consoleErrors.filter(
          (t) => !t.includes("CursorBrowser") && !t.includes("favicon"),
        );
        if (fatal.length) errors.push({ vp: vp.name, console: fatal });
      } catch (e) {
        errors.push({ vp: vp.name, error: String(e) });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (errors.length) {
    console.error("screenshot errors:", JSON.stringify(errors, null, 2));
    process.exit(1);
  }
  console.log(`report:screenshots OK → ${outDir}`);
}

main();
