#!/usr/bin/env node
/**
 * Fixture 리포트 → docs/assets/demo/ 마케팅 스크린샷 (Pages·README)
 *
 * Usage: npm run docs:capture-demo
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = "docs-demo";
const fixture = join("test", "fixtures", "vibecoding-room-sample.csv");
const outDir = join(root, "docs", "assets", "demo");
const port = Number(process.env.KCA_DOCS_PORT ?? "18766");
const baseUrl = `http://127.0.0.1:${port}/${encodeURIComponent(slug)}/`;

/** @type {Array<{ file: string; title: string; caption: string; selectors: string[]; optional?: boolean; viewport?: { width: number; height: number }; clipMaxH?: number; waitChart?: string; waitScatter?: string }>} */
const shots = [
  {
    file: "wrapped.png",
    title: "Wrapped",
    caption: "한 장면 요약·활동 카드",
    selectors: ["#s-wrapped"],
  },
  {
    file: "facts.png",
    title: "핵심 지표",
    caption: "총 메시지·참여자 히어로·지표 그리드",
    selectors: ["#s-facts"],
  },
  {
    file: "personas.png",
    title: "페르소나",
    caption: "참여자 아키타입 라벨",
    selectors: ["#s-personas"],
    optional: true,
  },
  {
    file: "calendar.png",
    title: "활동 그리드",
    caption: "일별 활동 히트맵",
    selectors: ["#s-calendar"],
    optional: true,
  },
  {
    file: "topics.png",
    title: "주제 맵",
    caption: "c-TF-IDF 테마·연관",
    selectors: ["#s-topics"],
  },
  {
    file: "charts-viz.png",
    title: "인터랙티브 차트",
    caption: "워드클라우드·ECharts",
    selectors: ["article.viz-card:has(#chart-kw-cloud)"],
    waitChart: "#chart-kw-cloud",
    clipMaxH: 640,
  },
  {
    file: "charts-rhythm.png",
    title: "리듬·히트맵",
    caption: "시간대·활동 차트",
    selectors: ["article.viz-card:has(#chart-hours)", "article.viz-card:has(#chart-daily-heat)"],
    waitChart: "#chart-hours",
    clipMaxH: 560,
  },
  {
    file: "keywords.png",
    title: "키워드",
    caption: "순위·비율 표",
    selectors: ["article.viz-card:has(.kw-table--ranked)"],
    clipMaxH: 640,
  },
  {
    file: "participants.png",
    title: "참여자",
    caption: "랭킹·말풍선 맵",
    selectors: [
      "#s-ai .insight-split > div:has(.sc-plot)",
      "#s-charts .card:has(.rank-participants)",
      "section.grid.two:has(.rank-participants)",
    ],
    waitScatter: ".sc-plot",
    clipMaxH: 720,
  },
  {
    file: "narrative.png",
    title: "방 프로필",
    caption: "자동 서사 요약",
    selectors: ["#s-narrative"],
    optional: true,
  },
  {
    file: "dyad.png",
    title: "상호작용",
    caption: "누가 누구에게 답하는가",
    selectors: ["#s-dyad"],
    optional: true,
  },
  {
    file: "mobile-wrapped.png",
    title: "모바일 Wrapped",
    caption: "390px 화면",
    selectors: ["#s-wrapped"],
    viewport: { width: 390, height: 844 },
  },
];

async function firstVisible(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  throw new Error(`no visible element for: ${selectors.join(" | ")}`);
}

async function waitChartCanvas(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const canvas = document.querySelector(`${sel} canvas`);
      if (!canvas) return false;
      const r = canvas.getBoundingClientRect();
      return r.width > 20 && r.height > 20;
    },
    selector,
    { timeout: 20_000 },
  );
}

async function waitScatterBubbles(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const plot = document.querySelector(sel);
      if (!plot) return false;
      const nodes = plot.querySelectorAll(".bubble-node");
      if (nodes.length === 0) return false;
      return Array.from(nodes).some((n) => n.getBoundingClientRect().width > 8);
    },
    selector,
    { timeout: 20_000 },
  );
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

function clipMaxHeight(shot, vp) {
  const isMobile = vp.width <= 400;
  return shot.clipMaxH ?? (isMobile ? 640 : 560);
}

async function captureShot(page, shot) {
  const vp = shot.viewport ?? { width: 1440, height: 900 };
  await page.setViewportSize(vp);
  if (shot.waitChart) {
    await waitChartCanvas(page, shot.waitChart);
  }
  if (shot.waitScatter) {
    await waitScatterBubbles(page, shot.waitScatter);
  }
  const el = await firstVisible(page, shot.selectors);
  await el.scrollIntoViewIfNeeded();
  await el.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
  await page.waitForTimeout(400);
  const box = await el.boundingBox();
  if (!box) throw new Error(`no bounding box for: ${shot.selectors.join(" | ")}`);
  const path = join(outDir, shot.file);
  const maxH = clipMaxHeight(shot, vp);
  const height = Math.min(Math.ceil(box.height), maxH);
  const clip =
    height < Math.ceil(box.height)
      ? { x: 0, y: 0, width: Math.ceil(box.width), height }
      : undefined;
  await el.screenshot({ path, ...(clip ? { clip } : {}) });
  console.log(`screenshot: ${path} (${Math.ceil(box.width)}×${height})`);
  return { file: shot.file, title: shot.title, caption: shot.caption };
}

async function applyCaptureTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("kca-report-theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
}

async function waitReportReady(page) {
  await page.waitForSelector("#s-wrapped", { timeout: 20_000 });
  await waitChartCanvas(page, "#chart-kw-cloud").catch(() => {});
  await page.waitForTimeout(500);
}

async function capture() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("playwright not installed — run: npm install");
    process.exit(1);
  }

  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  await mkdir(outDir, { recursive: true });
  const server = await startQaServe();
  const browser = await chromium.launch({ headless: true });
  const manifestItems = [];

  const captureTheme = process.env.KCA_DOCS_CAPTURE_THEME ?? "dark";

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: captureTheme === "dark" ? "dark" : "light",
    });
    const page = await context.newPage();
    await page.addInitScript((theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("kca-report-theme", theme);
      } catch {
        /* ignore */
      }
    }, captureTheme);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    let activeTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (activeTheme !== captureTheme) {
      await applyCaptureTheme(page, captureTheme);
      await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
    }
    await waitReportReady(page);
    activeTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    if (activeTheme !== captureTheme) {
      throw new Error(`capture theme: expected data-theme=${captureTheme}, got ${activeTheme ?? "null"}`);
    }

    for (const shot of shots) {
      try {
        const item = await captureShot(page, shot);
        manifestItems.push(item);
      } catch (e) {
        if (shot.optional) {
          console.warn(`skip optional ${shot.file}: ${e.message}`);
        } else {
          throw e;
        }
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const heroPath = join(outDir, "hero-wide.png");
    await page.screenshot({ path: heroPath, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    console.log(`screenshot: ${heroPath}`);

    const manifest = {
      version: pkg.version,
      items: manifestItems,
    };
    const manifestPath = join(outDir, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`manifest: ${manifestPath} (${manifestItems.length} items)`);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }

  console.log(`docs:capture-demo OK → ${outDir}`);
}

async function main() {
  if (process.env.KCA_DOCS_CAPTURE_ONLY !== "1") {
    console.log("build…");
    await run("npm", ["run", "build"]);
    console.log("generate report…");
    await run(
      "node",
      ["dist/src/cli.js", fixture, "--local", "-o", join(".qa-reports", slug)],
      { env: { ...process.env, KCA_NO_SEMANTIC: "1" } },
    );
  } else {
    console.log("capture-only: skip build/generate (.qa-reports/docs-demo must exist)");
  }
  await capture();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
