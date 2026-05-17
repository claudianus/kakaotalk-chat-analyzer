#!/usr/bin/env node
/**
 * Fixture 리포트 → docs/assets/demo/ 마케팅 스크린샷 (Pages·README)
 *
 * Usage: npm run docs:capture-demo
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = "docs-demo";
const outDir = join(root, "docs", "assets", "demo");
const port = Number(process.env.KCA_DOCS_PORT ?? "18766");
const baseUrl = `http://127.0.0.1:${port}/${encodeURIComponent(slug)}/`;

const shots = [
  { file: "wrapped.png", selectors: ["#s-wrapped"] },
  {
    file: "charts.png",
    selectors: ["#s-viz", "#chart-kw-cloud", "#s-charts"],
  },
  {
    file: "keywords.png",
    selectors: ["#s-topics", ".kw-css-fold", ".kw-table--ranked", "#chart-kw-cloud"],
  },
];

async function firstVisible(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  throw new Error(`no visible element for: ${selectors.join(" | ")}`);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

function startQaServe() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["scripts/qa-serve.mjs"], {
      cwd: root,
      env: { ...process.env, KCA_QA_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    const onLine = (buf) => {
      const s = buf.toString();
      if (!ready && s.includes(`127.0.0.1:${port}`)) {
        ready = true;
        resolve(child);
      }
    };
    child.stdout.on("data", onLine);
    child.stderr.on("data", onLine);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!ready) reject(new Error(`qa-serve exited ${code}`));
    });
    setTimeout(() => {
      if (!ready) reject(new Error("qa-serve timeout"));
    }, 15_000);
  });
}

async function capture() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not installed — run: npm install");
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const server = await startQaServe();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForSelector("#s-wrapped", { timeout: 20_000 });
    await page.waitForSelector(".chart-box canvas", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);

    for (const { file, selectors } of shots) {
      const el = await firstVisible(page, selectors);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const path = join(outDir, file);
      await el.screenshot({ path });
      console.log(`screenshot: ${path}`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const heroPath = join(outDir, "hero-wide.png");
    await page.screenshot({ path: heroPath, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    console.log(`screenshot: ${heroPath}`);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }

  console.log(`docs:capture-demo OK → ${outDir}`);
}

async function main() {
  console.log("build…");
  await run("npm", ["run", "build"]);
  console.log("generate report…");
  await run("node", [
    "dist/src/cli.js",
    "test/fixtures/keyword-golden.csv",
    "--local",
    "-o",
    join(".qa-reports", slug),
  ], {
    env: { ...process.env, KCA_NO_SEMANTIC: "1" },
  });
  await capture();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
