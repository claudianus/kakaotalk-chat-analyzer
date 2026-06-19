#!/usr/bin/env node
/**
 * Shot-frame + visual regression audit for report HTML (local http or BrewPage URL).
 *
 * Usage:
 *   node scripts/report-shot-audit.mjs <url-or-path> [--theme light|dark] [--viewport 1440x900]
 *   npm run report:qa:serve & node scripts/report-shot-audit.mjs http://127.0.0.1:18765/<slug>/
 */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const theme = argv.includes("--theme") ? argv[argv.indexOf("--theme") + 1] : "light";
const vpArg = argv.find((a) => /^\d+x\d+$/.test(a)) ?? "1440x900";
const [vpW, vpH] = vpArg.split("x").map(Number);
const maxShotH = Math.round(vpH * 0.92);
const target = argv.find((a) => !a.startsWith("--") && !/^\d+x\d+$/.test(a));

if (!target) {
  console.error("usage: node scripts/report-shot-audit.mjs <url|html-path> [1440x900] [--theme dark]");
  process.exit(2);
}

async function resolveUrl(input) {
  if (/^https?:\/\//i.test(input)) return input;
  const path = resolve(input);
  const html = await readFile(path, "utf8");
  const slug = path.split("/").slice(-2, -1)[0] ?? "audit";
  const port = Number(process.env.KCA_QA_PORT ?? "18765");
  return { path, slug, fallback: `http://127.0.0.1:${port}/${encodeURIComponent(slug)}/`, htmlBytes: Buffer.byteLength(html, "utf8") };
}

let url = target;
let meta = {};
if (!/^https?:\/\//i.test(target)) {
  meta = await resolveUrl(target);
  url = meta.fallback;
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright required — npm install");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: vpW, height: vpH } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.evaluate((mode) => {
  document.documentElement.setAttribute("data-theme", mode);
}, theme);
await page.waitForTimeout(2500);

const metrics = await page.evaluate((maxH) => {
  const failures = [];
  const warnings = [];
  const sections = Array.from(
    document.querySelectorAll(
      ".kca-shot-block, .kca-section[id], .kca-hero, .viz-card, .kca-shot-panel",
    ),
  )
    .filter((el) => el.getBoundingClientRect().height > 24)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const id = el.id || el.getAttribute("aria-label") || el.className.split(/\s+/).slice(0, 2).join(".");
      return { id, h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) };
    });

  const tall = sections.filter((s) => s.h > maxH);
  for (const s of tall) warnings.push(`tall section ${s.id}: ${s.h}px > ${maxH}px`);

  const missingAnchors = Array.from(document.querySelectorAll("[data-kca-jump]"))
    .map((el) => el.getAttribute("data-kca-jump"))
    .filter((id) => id && !document.getElementById(id));
  if (missingAnchors.length) failures.push(`missing anchors: ${[...new Set(missingAnchors)].join(", ")}`);

  const zeroBars = [];
  for (const fill of document.querySelectorAll(
    ".bar-fill, .dynamics-fill, .latency-fill, .kw-bar-fill, .hot-topic-bar-fill",
  )) {
    const style = getComputedStyle(fill);
    const w = fill.getBoundingClientRect().width;
    const pct = fill.style.width || "";
    const hidden =
      style.display === "none" ||
      style.visibility === "hidden" ||
      fill.closest("[hidden]") ||
      (fill.offsetParent === null && style.position !== "fixed");
    if (hidden) continue;
    if (w < 2 && /%/.test(pct) && parseFloat(pct) > 5) {
      zeroBars.push(`${fill.className} style=${pct} rendered=${w.toFixed(1)}px`);
    }
    if (style.opacity === "0" && w < 2 && /%/.test(pct)) {
      zeroBars.push(`opacity0 ${fill.className} ${pct}`);
    }
  }
  if (zeroBars.length) failures.push(`zero-width bars (${zeroBars.length}): ${zeroBars.slice(0, 8).join(" | ")}`);

  const failedCharts = Array.from(document.querySelectorAll(".chart-box[data-chart-failed='1']")).map(
    (el) => el.id,
  );
  if (failedCharts.length) failures.push(`failed charts: ${failedCharts.join(", ")}`);

  const emptyCharts = Array.from(document.querySelectorAll(".chart-box[data-chart-empty='1']")).map(
    (el) => el.id,
  );
  const narrowCharts = Array.from(document.querySelectorAll(".chart-box"))
    .map((el) => ({ id: el.id, w: Math.round(el.getBoundingClientRect().width) }))
    .filter((c) => c.w > 0 && c.w < 180);

  const scrollW = document.documentElement.scrollWidth;
  const clientW = document.documentElement.clientWidth;
  if (scrollW > clientW + 2) failures.push(`horizontal overflow ${scrollW}>${clientW}`);

  const hero = document.querySelector(".kca-hero");
  const heroH = hero ? Math.round(hero.getBoundingClientRect().height) : 0;

  const deckNav = document.querySelector(".deck-nav");
  const navOverflow =
    deckNav && deckNav.scrollWidth > deckNav.clientWidth + 2
      ? `deck-nav scroll ${deckNav.scrollWidth}/${deckNav.clientWidth}`
      : null;

  const provenanceBytes = document.querySelector("#kca-provenance-bytes")?.textContent?.trim() ?? "";

  return {
    failures,
    warnings,
    sections: sections.sort((a, b) => b.h - a.h).slice(0, 25),
    tallCount: tall.length,
    heroH,
    navOverflow,
    provenanceBytes,
    failedCharts,
    emptyCharts,
    narrowCharts,
    scrollW,
    clientW,
    version: document.querySelector('meta[name="generator"]')?.content ?? "",
  };
}, maxShotH);

const fatalConsole = consoleErrors.filter(
  (t) =>
    !t.includes("favicon") &&
    !t.includes("CursorBrowser") &&
    (t.includes("[kca-chart]") || t.includes("bootDyadWhenVisible") || t.includes("PAGEERROR")),
);
if (fatalConsole.length) metrics.failures.push(`console: ${fatalConsole.slice(0, 5).join(" | ")}`);

const report = {
  ok: metrics.failures.length === 0,
  url,
  theme,
  viewport: `${vpW}x${vpH}`,
  maxShotH,
  ...meta,
  ...metrics,
  consoleErrors: consoleErrors.slice(0, 12),
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
