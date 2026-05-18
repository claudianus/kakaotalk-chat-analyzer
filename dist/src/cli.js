#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { buildReportFromExport, reportUsedAnalyzeWorker } from "./analysis.js";
import { parseChatRoomNameFromExportPath } from "./analysis-labels.js";
import { defaultKakaoCsvDir, formatExportPickLine, listKakaoExports, resolveKakaoExport, } from "./kakao-export-discovery.js";
import { buildReportProvenance, patchReportProvenance } from "./report-provenance.js";
import { clearOwnerToken, getConfigPath, getOwnerToken, saveOwnerToken } from "./config.js";
import { describeStreamedExport } from "./stream-parser.js";
import { createProvider, parseHostName } from "./providers/index.js";
import { renderCompareHtml } from "./compare-report.js";
import { parseSinceOption } from "./report-date-filter.js";
import { renderReportHtml } from "./report.js";
import { formatCapabilitiesReport, probeMachineProfile } from "./analysis-capability.js";
import { buildAnalysisEffectiveConfig, configToJson, formatConfigSummaryKo, formatEstimatedPresetHint, toProvenanceOptions, withWorkerUsed, } from "./analysis-effective-config.js";
import { autoPresetFromMachine } from "./analysis-preset.js";
import { pullLlmGguf, parsePullSize } from "./llm-pull.js";
import { resolveLlmRunPlan } from "./llm-policy.js";
import { qwen35DisplayLabel } from "./llm-qwen35.js";
import { estimateKakaoMessageCount } from "./stream-parser.js";
import { VERSION } from "./version.js";
const DEFAULT_NAMESPACE = "kakao-chat-report";
const DEFAULT_OUT = ".tmp/kca-report";
const DEFAULT_TOP = 40;
const program = new Command();
program.name("kca").description("카카오톡 CSV 보내기 → 리포트 생성 → (선택) 임시 공유까지 한 번에.").version(VERSION);
program.addHelpText("after", `
기본 사용법:
  kca                            기본 저장 폴더에서 최신 KakaoTalk CSV → 업로드
  kca <보내기.csv>               지정 CSV → 업로드
  kca --local                    최신 CSV로 로컬 HTML만 (-o 로 폴더 지정)
  kca latest --list              후보 CSV 목록 (최신 10개)
  kca latest --pick 1            두 번째로 최근 CSV

npx 예시:
  npx kcachat@latest
  npx kcachat@latest --local
  npx kcachat@latest ./KakaoTalk_Chat_....csv
  KCA_CSV_DIR=~/Desktop npx kcachat@latest
`);
function registerPipelineOptions(cmd) {
    cmd
        .option("--local", "HTML만 만들고 업로드는 하지 않습니다.", false)
        .option("--dry-run", "업로드를 생략하고 리포트만 생성합니다.", false)
        .option("--host <host>", "brewpage, tempfile, cloudflare", "brewpage")
        .option("--ttl <days>", "임시 호스팅 TTL(일)", "30")
        .option("--ns <namespace>", "호스팅 네임스페이스", DEFAULT_NAMESPACE)
        .option("--privacy <mode>", "public-masked | public-anonymous", "public-masked")
        .option("--top <count>", "랭킹·상위 목록 길이", String(DEFAULT_TOP))
        .option("-o, --out <dir>", "리포트 출력 폴더", DEFAULT_OUT)
        .option("--profile", "파싱·집계·HTML 단계별 소요 시간을 출력합니다.", false)
        .option("--worker", "3MB 이상 CSV를 Worker 스레드로 집계합니다(빠름). 기본은 품질 우선(메인 스레드).", false)
        .option("--no-worker", "Worker를 쓰지 않고 메인 스레드에서 집계합니다(기본과 동일).", false)
        .option("--fast", "속도 우선(deprecated). --preset speed 와 동일.", false)
        .option("--preset <name>", "분석 preset: speed | balanced | quality | custom (미지정 시 RAM·코퍼스 자동)")
        .option("--no-progress", "분석·집계 진행률(%) 표시를 끕니다.", false)
        .option("--no-semantic-keywords", "한국어 방 기본 시맨틱 키워드(KoELECTRA 임베딩)를 끕니다.", false)
        .option("--semantic-keywords", "한국어 비중과 관계없이 시맨틱 키워드를 강제합니다(e5-small, 최초 다운로드).", false)
        .option("--no-sentiment", "한국어 방 기본 감정 분석(transformers)을 끕니다.", false)
        .option("--sentiment", "한국어 비중과 관계없이 감정 분석을 강제합니다(최초 모델 다운로드).", false)
        .option("--since <date>", "YYYY-MM-DD 이후 메시지만 집계합니다.")
        .option("--json-config", "완료 후 적용된 분석 설정을 JSON으로 stdout에 추가합니다.", false)
        .option("--json-config-only", "리포트 경로 없이 분석 설정 JSON만 stdout에 출력합니다(리포트 생성 후).", false);
}
function registerDiscoveryOptions(cmd) {
    cmd
        .option("--dir <path>", "KakaoTalk CSV 검색 폴더 (기본: KCA_CSV_DIR · Win: Documents\\카카오톡 받은 파일 · macOS: Downloads)")
        .option("--pick <n>", "0=최신, 1=두 번째로 최근 …", "0")
        .option("--list", "후보 CSV 목록만 출력하고 종료합니다.", false);
}
async function resolveCsvPath(csv, options) {
    if (csv?.trim())
        return resolve(csv);
    if (options.list) {
        const dir = options.dir ? resolve(options.dir) : defaultKakaoCsvDir();
        const all = await listKakaoExports(dir);
        if (all.length === 0) {
            throw new Error(`${dir}에 KakaoTalk*.csv가 없습니다.`);
        }
        console.log(`CSV 폴더: ${dir}\n`);
        for (let i = 0; i < Math.min(10, all.length); i += 1) {
            const f = all[i];
            const room = parseChatRoomNameFromExportPath(f.path);
            console.log(`[${i}] ${formatExportPickLine(f, room)}`);
            console.log(`    ${f.path}`);
        }
        if (all.length > 10)
            console.log(`… 외 ${all.length - 10}개`);
        return null;
    }
    const pick = parsePickIndex(options.pick);
    const picked = await resolveKakaoExport({
        dir: options.dir,
        index: pick,
    });
    const room = parseChatRoomNameFromExportPath(picked.path);
    console.error(`[kca] 선택: ${formatExportPickLine(picked, room)}`);
    console.error(`[kca] 경로: ${picked.path}`);
    return picked.path;
}
async function runMainPipeline(csvPath, options) {
    const host = parseHostName(options.host);
    const ttlDays = parseTtl(options.ttl);
    const namespace = sanitizeNamespace(options.ns);
    const privacy = parsePrivacy(options.privacy);
    const top = parsePositiveInt(options.top, DEFAULT_TOP);
    const pipeline = buildPipelineOptions(options);
    let messageEstimate;
    try {
        messageEstimate = await estimateKakaoMessageCount(csvPath);
        console.error(formatEstimatedPresetHint(pipeline, messageEstimate));
    }
    catch {
        console.error(formatEstimatedPresetHint(pipeline));
    }
    const { htmlPath, config } = await generateReport(csvPath, {
        outDir: options.out,
        privacy,
        top,
        profile: options.profile,
        ...pipeline,
        progress: !options.noProgress,
    });
    if (options.jsonConfigOnly) {
        console.log(configToJson(config));
        return;
    }
    console.log(formatConfigSummaryKo(config));
    console.log(`리포트: ${htmlPath}`);
    console.log(`크기: ${await formatFileSize(htmlPath)}`);
    if (options.jsonConfig) {
        console.log(configToJson(config));
    }
    if (options.local) {
        console.log("--local: 업로드를 하지 않습니다.");
        return;
    }
    if (options.dryRun) {
        console.log("드라이런: 업로드를 건너뜁니다.");
        return;
    }
    try {
        const provider = createProvider(host);
        const owner = await getOwnerToken(host, namespace);
        const html = await readReportHtml(htmlPath);
        const result = await provider.publish({
            html,
            ttlDays,
            namespace,
            title: "카카오톡 대화 리포트",
            ownerToken: owner?.ownerToken,
        });
        if (result.ownerToken) {
            await saveOwnerToken({
                provider: result.provider,
                namespace,
                ownerToken: result.ownerToken,
                ownerLink: result.ownerLink,
                id: result.id,
                link: result.link,
                expiresAt: result.expiresAt,
            });
        }
        printPublishResult(result, namespace);
    }
    catch (error) {
        console.error(`업로드 실패: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`로컬 리포트는 그대로 있습니다: ${htmlPath}`);
        if (host === "brewpage") {
            console.error(`TempFile로 시도하려면: npx kakaotalk-chat-analyzer "${csvPath}" --host tempfile --ttl ${ttlDays}`);
        }
        process.exitCode = 1;
    }
}
const main = program.command("default", { isDefault: true, hidden: true });
registerPipelineOptions(main);
registerDiscoveryOptions(main);
main
    .argument("[csv]", "카카오톡 CSV 보내기 (생략 시 최신 KakaoTalk*.csv 자동 선택)")
    .description("리포트 생성 후 BrewPage 업로드 (--local로 로컬만).")
    .action(async (csv, options) => {
    const csvPath = await resolveCsvPath(csv, options);
    if (csvPath === null)
        return;
    await runMainPipeline(csvPath, options);
});
const latest = program
    .command("latest")
    .description("KCA_CSV_DIR(기본 OS별 카카오톡 폴더)에서 최신 KakaoTalk CSV로 리포트·업로드.");
registerPipelineOptions(latest);
registerDiscoveryOptions(latest);
latest.action(async (options) => {
    const csvPath = await resolveCsvPath(undefined, options);
    if (csvPath === null)
        return;
    await runMainPipeline(csvPath, options);
});
program
    .command("compare")
    .argument("<csv...>", "비교할 CSV 2개 이상")
    .option("-o, --out <file>", "출력 HTML 경로", "compare.html")
    .description("여러 방 export의 핵심 지표를 한 표로 비교합니다.")
    .action(async (csvs, options) => {
    if (csvs.length < 2) {
        throw new Error("compare requires at least 2 CSV files.");
    }
    const reports = [];
    for (const csv of csvs) {
        reports.push(await buildReportFromExport(resolve(csv), {
            progress: false,
            worker: false,
            semanticKeywords: false,
        }));
    }
    const html = renderCompareHtml(reports);
    const outPath = resolve(options.out);
    await writeFile(outPath, html, "utf8");
    console.log(`비교 리포트: ${outPath}`);
});
const llmCmd = program.command("llm").description("로컬 LLM(GGUF) 모델 관리");
llmCmd
    .command("pull")
    .argument("[size]", "0.8B | 2B | 4B | 9B — 생략 시 RAM 기준 자동 최대")
    .description("Hugging Face에서 GGUF를 ~/.cache/kakaotalk-chat-analyzer/llm/ 에 받습니다.")
    .option("--preset <name>", "자동 선택 시 preset (speed|balanced|quality)", "balanced")
    .action(async (size, opts) => {
    const profile = await probeMachineProfile();
    const preset = opts.preset;
    const plan = size
        ? { enabled: true, size: parsePullSize(size), reason: "CLI" }
        : resolveLlmRunPlan({ preset, profile });
    if (!plan.enabled || !plan.size) {
        console.error(`[kca] LLM pull 불가: ${plan.reason}`);
        process.exitCode = 1;
        return;
    }
    process.stderr.write(`[kca] pull 대상: ${qwen35DisplayLabel(plan.size)} (${plan.reason})\n`);
    const path = await pullLlmGguf(plan.size);
    console.log(`모델 경로: ${path}`);
});
program
    .command("capabilities")
    .description("RAM·CPU·추천 preset·예상 분석 시간을 출력합니다.")
    .option("--messages <n>", "메시지 수(예상)", "90000")
    .action(async (options) => {
    const profile = await probeMachineProfile();
    const n = Number.parseInt(options.messages, 10) || 90_000;
    const preset = autoPresetFromMachine(profile, n);
    console.log(formatCapabilitiesReport(profile, { preset, messageCount: n }));
});
program
    .command("inspect")
    .argument("<csv>", "카카오톡 CSV 보내기")
    .description("보내기 구조만 점검합니다(대화 원문은 출력하지 않음).")
    .action(async (csv) => {
    const summary = await describeStreamedExport(resolve(csv));
    console.log(summary.text);
    if (summary.warnings.length > 0) {
        console.log("\n경고 상세:");
        for (const warning of summary.warnings.slice(0, 10)) {
            console.log(`- ${warning.line}행: ${warning.code}`);
        }
        if (summary.warnings.length > 10) {
            console.log(`- … 외 ${summary.warnings.length - 10}건`);
        }
    }
});
const token = program.command("token").description("로컬에 저장된 owner 토큰 관리.");
token
    .command("clear")
    .option("--host <host>", "brewpage | tempfile | cloudflare", "brewpage")
    .option("--ns <namespace>", "네임스페이스", DEFAULT_NAMESPACE)
    .description("저장된 owner 토큰을 삭제합니다.")
    .action(async (options) => {
    const host = parseHostName(options.host);
    const namespace = sanitizeNamespace(options.ns);
    const cleared = await clearOwnerToken(host, namespace);
    console.log(cleared ? `${host}/${namespace} 토큰을 지웠습니다.` : `${host}/${namespace}에 저장된 토큰이 없습니다.`);
});
program.configureHelp({ sortSubcommands: true });
program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
function parsePresetOption(preset, fast) {
    if (fast)
        return "speed";
    const p = preset?.trim().toLowerCase();
    if (p === "speed" || p === "balanced" || p === "quality" || p === "custom")
        return p;
    if (preset?.trim())
        throw new Error(`지원하지 않는 preset: "${preset}". speed|balanced|quality|custom`);
    return undefined;
}
function buildPipelineOptions(options) {
    return {
        preset: parsePresetOption(options.preset, options.fast),
        worker: options.fast || options.worker ? true : options.noWorker ? false : undefined,
        semanticKeywords: options.noSemanticKeywords
            ? false
            : options.semanticKeywords
                ? true
                : undefined,
        sentiment: options.noSentiment ? false : options.sentiment ? true : undefined,
        since: parseSinceOption(options.since),
    };
}
function parsePickIndex(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) {
        throw new Error(`--pick 값은 0 이상의 정수여야 합니다: "${value}"`);
    }
    return n;
}
async function generateReport(csv, options) {
    const csvPath = resolve(csv);
    const log = options.profile ? (label, ms) => console.error(`[kca] ${label}: ${ms}ms`) : () => { };
    const buildOpts = {
        privacy: options.privacy,
        top: options.top,
        preset: options.preset,
        worker: options.worker,
        progress: options.progress,
        semanticKeywords: options.semanticKeywords,
        sentiment: options.sentiment,
        since: options.since,
    };
    let t0 = performance.now();
    const workerUsed = await reportUsedAnalyzeWorker(csvPath, buildOpts);
    const data = await buildReportFromExport(csvPath, buildOpts);
    const parseAggregateMs = Math.round(performance.now() - t0);
    log("parse+aggregate", parseAggregateMs);
    const outDir = resolve(options.outDir);
    const htmlPath = resolve(outDir, "index.html");
    const buildTiming = {
        parseAggregateMs,
        renderHtmlMs: 0,
        writeFileMs: 0,
        totalMs: parseAggregateMs,
    };
    const machine = await probeMachineProfile();
    let config = withWorkerUsed(buildAnalysisEffectiveConfig(data, {
        privacy: options.privacy,
        top: options.top,
        since: options.since,
        preset: options.preset,
        worker: options.worker,
        semanticKeywords: options.semanticKeywords,
        sentiment: options.sentiment,
    }, machine), workerUsed);
    const buildProvenance = (timing, htmlBytes) => buildReportProvenance(data, toProvenanceOptions(config, data, {
        kiwiAvailable: data.kiwiAvailableAtAnalysis === true,
        buildTiming: timing,
        htmlBytes,
    }));
    t0 = performance.now();
    let html = renderReportHtml({
        ...data,
        buildTiming,
        provenance: buildProvenance(buildTiming),
    });
    buildTiming.renderHtmlMs = Math.round(performance.now() - t0);
    log("render HTML", buildTiming.renderHtmlMs);
    if (options.profile) {
        console.error(`[kca] messages: ${data.summary.totalMessages.toLocaleString("ko-KR")}`);
    }
    buildTiming.totalMs = buildTiming.parseAggregateMs + buildTiming.renderHtmlMs;
    const provenance = buildProvenance(buildTiming, Buffer.byteLength(html, "utf8"));
    html = patchReportProvenance(html, provenance);
    t0 = performance.now();
    await mkdir(outDir, { recursive: true });
    await writeFile(htmlPath, html, "utf8");
    buildTiming.writeFileMs = Math.round(performance.now() - t0);
    buildTiming.totalMs += buildTiming.writeFileMs;
    log("write file", buildTiming.writeFileMs);
    if (options.profile) {
        console.error(`[kca] build total: ${buildTiming.totalMs}ms (aggregate ${buildTiming.parseAggregateMs} · html ${buildTiming.renderHtmlMs} · write ${buildTiming.writeFileMs})`);
    }
    return { htmlPath, config };
}
async function readReportHtml(htmlPath) {
    const { readFile } = await import("node:fs/promises");
    return readFile(htmlPath, "utf8");
}
function parsePrivacy(value) {
    if (value === "public-masked" || value === "public-anonymous")
        return value;
    throw new Error(`지원하지 않는 privacy 모드입니다: "${value}". public-masked 또는 public-anonymous 만 사용할 수 있습니다.`);
}
function parseTtl(value) {
    const ttl = parsePositiveInt(value, 30);
    return Math.max(1, Math.min(30, ttl));
}
function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function sanitizeNamespace(value) {
    const normalized = value.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,32}$/.test(normalized)) {
        throw new Error("네임스페이스는 [a-z0-9-]{3,32} 형식이어야 합니다.");
    }
    return normalized;
}
async function formatFileSize(filePath) {
    const size = (await stat(filePath)).size;
    if (size < 1024)
        return `${size} B`;
    if (size < 1024 * 1024)
        return `${(size / 1024).toFixed(1)} KiB`;
    return `${(size / 1024 / 1024).toFixed(2)} MiB`;
}
function printPublishResult(result, namespace) {
    console.log(`공유 URL: ${result.link}`);
    if (result.expiresAt)
        console.log(`만료: ${result.expiresAt}`);
    if (result.ownerLink)
        console.log(`관리(삭제) 링크: ${result.ownerLink}`);
    if (result.ownerToken)
        console.log(`Owner 토큰: ${maskToken(result.ownerToken)} (${getConfigPath()}에 저장됨)`);
    console.log(`호스트: ${result.provider}`);
    console.log(`네임스페이스: ${namespace}`);
}
function maskToken(token) {
    if (token.length <= 10)
        return "********";
    return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
//# sourceMappingURL=cli.js.map