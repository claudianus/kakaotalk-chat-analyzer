#!/usr/bin/env node
/**
 * Downloads(또는 KCA_QA_CSV_DIR)의 KakaoTalk CSV로 리포트를 생성하고 브라우저에서 검수할 URL을 낸다.
 *
 * Usage:
 *   npm run report:qa
 *   npm run report:qa -- --all
 *   npm run report:qa -- --latest 3 --no-open
 *   KCA_CSV_DIR=~/Downloads npm run report:qa
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReportFromExport } from "../dist/src/analysis.js";
import { probeMachineProfileSync } from "../dist/src/analysis-capability.js";
import {
  buildAnalysisEffectiveConfig,
  toProvenanceOptions,
} from "../dist/src/analysis-effective-config.js";
import { defaultKakaoCsvDir, listKakaoExports } from "../dist/src/kakao-export-discovery.js";
import { buildReportProvenance } from "../dist/src/report-provenance.js";
import { renderReportHtml } from "../dist/src/report.js";
import { VERSION } from "../dist/src/version.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = resolve(process.env.KCA_QA_OUT ?? join(root, ".qa-reports"));

function normPath(s) {
  return s.normalize("NFC");
}

function slugFromCsv(name) {
  return normPath(
    name
      .replace(/^KakaoTalk_Chat_/i, "")
      .replace(/\.csv$/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "export",
  );
}

function parseArgs(argv) {
  const opts = {
    all: false,
    latest: Number(process.env.KCA_QA_MAX ?? "2"),
    open: process.env.KCA_QA_OPEN !== "0",
    semantic: process.env.KCA_NO_SEMANTIC !== "1",
    worker: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--all") opts.all = true;
    else if (a === "--no-open") opts.open = false;
    else if (a === "--no-semantic") opts.semantic = false;
    else if (a === "--latest") {
      opts.latest = Number(argv[++i] ?? "2");
    } else if (a === "--help" || a === "-h") {
      console.log(`Usage: npm run report:qa -- [--all] [--latest N] [--no-open] [--no-semantic]`);
      process.exit(0);
    }
  }
  if (opts.all) opts.latest = Infinity;
  return opts;
}

/** HTML에 필수 섹션·에셋이 있는지 기계 검사(브라우저 전 1차) */
function assertHtmlStructure(html, label) {
  const must = [
    ["Wrapped", /Wrapped|wrapped|⓪/i],
    ["ECharts", /echarts/i],
    ["키워드", /키워드|keyword/i],
    ["참여자", /참여|participant/i],
    ["Provenance", /id="kca-provenance"/],
    ["Version", new RegExp(`"version":"${VERSION.replace(/\./g, "\\.")}"`)],
    ["<!DOCTYPE html>", /<!DOCTYPE html>/i],
  ];
  const missing = must.filter(([, re]) => !re.test(html)).map(([n]) => n);
  if (missing.length) {
    throw new Error(`[${label}] HTML structure missing: ${missing.join(", ")}`);
  }
  if (html.length < 8000) {
    throw new Error(`[${label}] HTML suspiciously small (${html.length} bytes)`);
  }
  const chartIds = ["chart-hours", "chart-kw-cloud"];
  for (const id of chartIds) {
    if (!html.includes(`id="${id}"`)) {
      throw new Error(`[${label}] missing chart container #${id}`);
    }
  }
}

/** 대용량 코퍼스: 의미 테마 ≥2 또는 상위 키워드가 테마 terms에 포함 */
function assertTopicSanity(data, label) {
  const n = data.summary?.totalMessages ?? 0;
  if (n < 10_000) return;
  const themes = (data.topics ?? []).filter((t) => t.kind === "theme");
  if (themes.length >= 2) return;
  const topKw = data.keywords?.[0]?.label;
  if (!topKw) return;
  const inTheme = themes.some((t) => t.terms?.some((term) => topKw.includes(term) || term.includes(topKw)));
  if (!inTheme) {
    throw new Error(
      `[${label}] topics: ${themes.length} themes for ${n.toLocaleString()} messages; top keyword "${topKw}" not in theme terms`,
    );
  }
}

/** 대용량 코퍼스에서 dual-lane 키워드 1위 df 하한 */
function assertKeywordSanity(data, label) {
  const n = data.summary?.totalMessages ?? 0;
  if (n < 10_000 || !data.keywords?.length) return;
  const top = data.keywords[0];
  const minDf = n >= 50_000 ? 40 : 20;
  if (top.count < minDf) {
    throw new Error(
      `[${label}] top keyword "${top.label}" df=${top.count} < ${minDf} (${n.toLocaleString()} messages)`,
    );
  }
}

async function generateOne(csvPath, opts) {
  const slug = slugFromCsv(basename(csvPath));
  const outDir = join(outRoot, slug);
  await mkdir(outDir, { recursive: true });

  const t0 = performance.now();
  const data = await buildReportFromExport(csvPath, {
    progress: true,
    worker: opts.worker,
    semanticKeywords: opts.semantic ? undefined : false,
  });
  const config = buildAnalysisEffectiveConfig(
    data,
    {
      privacy: "public-masked",
      top: 40,
      worker: opts.worker,
      semanticKeywords: opts.semantic ? undefined : false,
    },
    probeMachineProfileSync(),
  );
  const provenance = buildReportProvenance(
    data,
    toProvenanceOptions(config, data, {
      kiwiAvailable: data.kiwiAvailableAtAnalysis === true,
      htmlBytes: 0,
    }),
  );
  const html = renderReportHtml({ ...data, provenance });
  assertHtmlStructure(html, slug);
  assertKeywordSanity(data, slug);
  assertTopicSanity(data, slug);

  const htmlPath = join(outDir, "index.html");
  await writeFile(htmlPath, html, "utf8");

  const port = Number(process.env.KCA_QA_PORT ?? "18765");
  const meta = {
    csv: csvPath,
    html: htmlPath,
    fileUrl: `file://${htmlPath}`,
    httpUrl: `http://127.0.0.1:${port}/${slug}/`,
    slug,
    messages: data.summary.totalMessages,
    keywords: data.keywords.slice(0, 12).map((k) => k.label),
    topics: data.topics.length,
    ms: Math.round(performance.now() - t0),
  };
  await writeFile(join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  return meta;
}

function openInBrowser(fileUrl) {
  if (process.platform === "darwin") {
    spawn("open", [fileUrl.replace(/^file:\/\//, "")], { stdio: "ignore", detached: true }).unref();
    return;
  }
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", fileUrl], { stdio: "ignore", detached: true }).unref();
    return;
  }
  spawn("xdg-open", [fileUrl.replace(/^file:\/\//, "")], { stdio: "ignore", detached: true }).unref();
}

const CHECKLIST = `
## 리포트 시각 QA 체크리스트 (에이전트가 브라우저로 직접 확인)

- [ ] Wrapped: 카드 레이아웃·한글 수치(만/억)·빈 섹션 없음
- [ ] 빠른 이동·앵커 점프 동작
- [ ] ECharts: 워드클라우드·시간대·잔디·주제 맵 로드·리사이즈
- [ ] 키워드 순위 목록: 인라인 막대·상위 3색·120행 스크롤·잡음·2-gram 없음
- [ ] 참여자·말풍선 맵·마스킹
- [ ] 라이트/다크/시스템 테마 전환
- [ ] 모바일 폭(~390px): 가로 스크롤·겹침 없음
- [ ] 콘솔 에러 없음 (browser_console_messages)
- [ ] Provenance: 생성 도구 kca 버전 · 리포트 정보 접기
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const csvDir = defaultKakaoCsvDir();

  const all = await listKakaoExports(csvDir);
  if (!all.length) {
    console.error(`No KakaoTalk*.csv in ${csvDir}`);
    process.exit(1);
  }

  const picked = all
    .slice(0, Number.isFinite(opts.latest) ? opts.latest : 2)
    .map((f) => ({ full: f.path, name: f.name, size: f.size }));
  console.error(`[report:qa] CSV dir: ${csvDir}`);
  console.error(`[report:qa] Generating ${picked.length}/${all.length} report(s) → ${outRoot}`);
  console.error(`[report:qa] semantic=${opts.semantic} open=${opts.open}`);

  const results = [];
  for (const f of picked) {
    console.error(`\n[report:qa] ▶ ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MiB)`);
    results.push(await generateOne(f.full, opts));
  }

  await writeFile(
    join(outRoot, "manifest.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
    "utf8",
  );

  console.log("\n--- report:qa manifest ---");
  const port = Number(process.env.KCA_QA_PORT ?? "18765");
  console.log(`\n브라우저 검수: 다른 터미널에서 npm run report:qa:serve 후 아래 http URL 사용`);
  for (const r of results) {
    console.log(`${r.slug}:`);
    console.log(`  http: ${r.httpUrl}`);
    console.log(`  file: ${r.fileUrl}`);
    console.log(`  messages=${r.messages} topics=${r.topics} ms=${r.ms}`);
    console.log(`  top keywords: ${r.keywords.join(", ")}`);
    if (opts.open) openInBrowser(r.httpUrl);
  }
  console.log(CHECKLIST);
  console.log(`manifest: ${join(outRoot, "manifest.json")}`);
  console.log("report:qa OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
