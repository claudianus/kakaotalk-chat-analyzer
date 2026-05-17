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

/** @type {Array<{ file: string; title: string; caption: string; selectors: string[]; optional?: boolean; viewport?: { width: number; height: number } }>} */
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
    caption: "메시지·참여자·리듬 숫자 요약",
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
    selectors: ["#s-viz", "#chart-kw-cloud"],
  },
  {
    file: "charts-rhythm.png",
    title: "리듬·히트맵",
    caption: "시간대·일별 활동",
    selectors: ["#s-charts .grid.two", "#s-charts"],
  },
  {
    file: "keywords.png",
    title: "키워드",
    caption: "순위·비율 표",
    selectors: [".kw-table--ranked", ".kw-css-fold", "#s-topics"],
  },
  {
    file: "participants.png",
    title: "참여자",
    caption: "랭킹·말풍선 맵",
    selectors: [".rank-participants"],
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

function clipForElement(box, vp) {
  const isMobile = vp.width <= 400;
  const minH = isMobile ? 320 : 360;
  const maxH = isMobile ? 640 : 560;
  const x = Math.max(0, Math.floor(box.x));
  let y = Math.max(0, Math.floor(box.y));
  const width = Math.min(Math.ceil(box.width), vp.width - x);
  let height = Math.min(Math.max(Math.ceil(box.height), minH), maxH);
  if (y + height > vp.height) {
    y = Math.max(0, vp.height - height);
  }
  return { x, y, width, height };
}

async function captureShot(page, shot) {
  const vp = shot.viewport ?? { width: 1440, height: 900 };
  await page.setViewportSize(vp);
  const el = await firstVisible(page, shot.selectors);
  await el.scrollIntoViewIfNeeded();
  await el.evaluate((node) => node.scrollIntoView({ block: "start", inline: "nearest" }));
  await page.waitForTimeout(300);
  const box = await el.boundingBox();
  if (!box) throw new Error(`no bounding box for: ${shot.selectors.join(" | ")}`);
  const path = join(outDir, shot.file);
  const clip = clipForElement(box, vp);
  await page.screenshot({ path, clip });
  console.log(`screenshot: ${path} (${clip.width}×${clip.height})`);
  return { file: shot.file, title: shot.title, caption: shot.caption };
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

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForSelector("#s-wrapped", { timeout: 20_000 });
    await page.waitForSelector(".chart-box canvas", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);

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
  console.log("build…");
  await run("npm", ["run", "build"]);
  console.log("generate report…");
  await run(
    "node",
    ["dist/src/cli.js", fixture, "--local", "-o", join(".qa-reports", slug)],
    { env: { ...process.env, KCA_NO_SEMANTIC: "1" } },
  );
  await capture();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
