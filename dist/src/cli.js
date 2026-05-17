#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { buildReportFromExport, reportUsedAnalyzeWorker } from "./analysis.js";
import { buildReportProvenance, patchReportProvenance } from "./report-provenance.js";
import { clearOwnerToken, getConfigPath, getOwnerToken, saveOwnerToken } from "./config.js";
import { describeStreamedExport } from "./stream-parser.js";
import { createProvider, parseHostName } from "./providers/index.js";
import { renderCompareHtml } from "./compare-report.js";
import { parseSinceOption } from "./report-date-filter.js";
import { renderReportHtml } from "./report.js";
import { VERSION } from "./version.js";
const DEFAULT_NAMESPACE = "kakao-chat-report";
const DEFAULT_OUT = ".tmp/kca-report";
const DEFAULT_TOP = 40;
const program = new Command();
program.name("kca").description("카카오톡 CSV 보내기 → 리포트 생성 → (선택) 임시 공유까지 한 번에.").version(VERSION);
program.addHelpText("after", `
기본 사용법 (서브커맨드 없이):
  kca <보내기.csv>                 HTML 리포트 생성 후 BrewPage에 업로드
  kca <보내기.csv> --local         업로드 없이 로컬에만 저장 (-o 로 폴더 지정)
  kca <보내기.csv> --dry-run       업로드 생략(미리 생성만)

npx 예시 (짧은 이름):
  npx kcachat@latest <보내기.csv> --local
  npx kcachat@latest <보내기.csv>
  (전체 패키지명: npx kakaotalk-chat-analyzer@latest … 동일)
`);
const main = program.command("default", { isDefault: true, hidden: true });
main
    .argument("<csv>", "카카오톡 CSV 보내기 파일 경로")
    .option("--local", "HTML만 만들고 업로드는 하지 않습니다.", false)
    .option("--dry-run", "업로드를 생략하고 리포트만 생성합니다.", false)
    .option("--host <host>", "brewpage, tempfile, cloudflare", "brewpage")
    .option("--ttl <days>", "임시 호스팅 TTL(일)", "30")
    .option("--ns <namespace>", "호스팅 네임스페이스", DEFAULT_NAMESPACE)
    .option("--privacy <mode>", "public-masked | public-anonymous", "public-masked")
    .option("--top <count>", "랭킹·상위 목록 길이", String(DEFAULT_TOP))
    .option("-o, --out <dir>", "리포트 출력 폴더", DEFAULT_OUT)
    .option("--profile", "파싱·집계·HTML 단계별 소요 시간을 출력합니다.", false)
    .option("--no-worker", "3MB 이상 파일도 Worker 없이 메인 스레드에서 집계합니다.", false)
    .option("--no-progress", "분석·집계 진행률(%) 표시를 끕니다.", false)
    .option("--no-semantic-keywords", "한국어 방 기본 시맨틱 키워드(multilingual-e5-small)를 끕니다.", false)
    .option("--semantic-keywords", "한국어 비중과 관계없이 시맨틱 키워드를 강제합니다(e5-small, 최초 다운로드).", false)
    .option("--since <date>", "YYYY-MM-DD 이후 메시지만 집계합니다.")
    .description("기본: 리포트 생성 후 BrewPage로 업로드(로컬만은 --local).")
    .action(async (csv, options) => {
    const host = parseHostName(options.host);
    const ttlDays = parseTtl(options.ttl);
    const namespace = sanitizeNamespace(options.ns);
    const privacy = parsePrivacy(options.privacy);
    const top = parsePositiveInt(options.top, DEFAULT_TOP);
    const htmlPath = await generateReport(csv, {
        outDir: options.out,
        privacy,
        top,
        profile: options.profile,
        worker: options.noWorker || options.profile ? false : undefined,
        progress: !options.noProgress,
        semanticKeywords: options.noSemanticKeywords
            ? false
            : options.semanticKeywords
                ? true
                : undefined,
        since: parseSinceOption(options.since),
    });
    console.log(`리포트: ${htmlPath}`);
    console.log(`크기: ${await formatFileSize(htmlPath)}`);
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
            console.error(`TempFile로 시도하려면: npx kakaotalk-chat-analyzer "${csv}" --host tempfile --ttl ${ttlDays}`);
        }
        process.exitCode = 1;
    }
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
async function generateReport(csv, options) {
    const csvPath = resolve(csv);
    const log = options.profile ? (label, ms) => console.error(`[kca] ${label}: ${ms}ms`) : () => { };
    const buildOpts = {
        privacy: options.privacy,
        top: options.top,
        worker: options.worker,
        progress: options.progress,
        semanticKeywords: options.semanticKeywords,
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
    const preliminaryProvenance = buildReportProvenance(data, {
        privacy: options.privacy,
        top: options.top,
        since: options.since,
        workerRequested: resolveWorkerRequested(options.worker),
        workerUsed,
        semanticRequested: resolveSemanticRequested(options.semanticKeywords),
        kiwiAvailable: data.kiwiAvailableAtAnalysis === true,
        buildTiming: { ...buildTiming },
    });
    t0 = performance.now();
    let html = renderReportHtml({ ...data, buildTiming, provenance: preliminaryProvenance });
    buildTiming.renderHtmlMs = Math.round(performance.now() - t0);
    log("render HTML", buildTiming.renderHtmlMs);
    if (options.profile) {
        console.error(`[kca] messages: ${data.summary.totalMessages.toLocaleString("ko-KR")}`);
    }
    buildTiming.totalMs = buildTiming.parseAggregateMs + buildTiming.renderHtmlMs;
    const provenance = buildReportProvenance(data, {
        privacy: options.privacy,
        top: options.top,
        since: options.since,
        workerRequested: resolveWorkerRequested(options.worker),
        workerUsed,
        semanticRequested: resolveSemanticRequested(options.semanticKeywords),
        kiwiAvailable: data.kiwiAvailableAtAnalysis === true,
        buildTiming: { ...buildTiming },
        htmlBytes: Buffer.byteLength(html, "utf8"),
    });
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
    return htmlPath;
}
async function readReportHtml(htmlPath) {
    const { readFile } = await import("node:fs/promises");
    return readFile(htmlPath, "utf8");
}
function resolveWorkerRequested(worker) {
    if (worker === false)
        return false;
    if (worker === true)
        return true;
    return "auto";
}
function resolveSemanticRequested(semanticKeywords) {
    if (semanticKeywords === false)
        return false;
    if (semanticKeywords === true)
        return true;
    return "auto";
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