import { ReportAggregator } from "./aggregator.js";
import { HeuristicPrepassCollector } from "./export-prepass.js";
import { loadGlossaryForExport } from "./glossary.js";
import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { getKiwiRuntime, initKiwiRuntime } from "./kiwi-runtime.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker } from "./analyze-pool.js";
import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import { logReportProgress, resetReportProgress } from "./report-progress.js";
import { resolveSemanticKeywords, shouldCollectSemanticSamples } from "./semantic-policy.js";
import { extractSemanticKeywords } from "./semantic-keywords.js";
import { createMessageSpoolPath, iterateSpoolRecords, removeSpool } from "./analysis-spool.js";
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { estimateKakaoMessageCount, streamKakaoExport } from "./stream-parser.js";
import { recordOnOrAfter } from "./report-date-filter.js";
const DEFAULT_TOP = 30;
function withKiwiAnalysisFlag(report) {
    return { ...report, kiwiAvailableAtAnalysis: getKiwiRuntime() != null };
}
function mergeUserWords(...lists) {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
        for (const uw of list) {
            if (seen.has(uw.word))
                continue;
            seen.add(uw.word);
            out.push(uw);
        }
    }
    return out.slice(0, 96);
}
/** Kiwi 등 리포트 엔진 준비(스트리밍 분석 전 1회 호출) */
export async function prepareReportEngine() {
    await initKiwiRuntime();
}
async function applySemanticKeywords(agg, enabled, showProgress) {
    if (!enabled)
        return false;
    const corpusMessages = agg.messageCount();
    const samples = agg.drainSemanticSamples();
    if (samples.length < 48)
        return false;
    if (showProgress)
        logReportProgress({ phase: "시맨틱 키워드", current: 0 });
    const items = await extractSemanticKeywords(samples, {
        stopwords: buildKeywordStopwords(),
        corpusMessages,
        onProgress: showProgress
            ? (current, total) => logReportProgress({ phase: "시맨틱 키워드", current, total })
            : undefined,
    });
    if (items.length > 0)
        agg.applySemanticKeywordBoost(items);
    return items.length > 0;
}
export function buildReportData(result, options) {
    const privacy = options?.privacy ?? "public-masked";
    const top = options?.top ?? DEFAULT_TOP;
    const texts = result.records.map((r) => r.message);
    const korean = isPrimarilyKoreanMessages(texts);
    const agg = new ReportAggregator(result.filePath, privacy, top, {
        semanticSamples: shouldCollectSemanticSamples(result.records.length),
        estimatedMessages: result.records.length,
    });
    const since = options?.since;
    for (const record of result.records) {
        if (since && !recordOnOrAfter(record, since))
            continue;
        agg.consume(record);
    }
    return withKiwiAnalysisFlag(agg.finalize({
        filePath: result.filePath,
        encoding: result.encoding,
        physicalLines: result.physicalLines,
        warningCount: result.warnings.length,
    }, { koreanPrimary: korean }));
}
export async function buildReportDataAsync(result, options) {
    await prepareReportEngine();
    const privacy = options?.privacy ?? "public-masked";
    const top = options?.top ?? DEFAULT_TOP;
    const texts = result.records.map((r) => r.message);
    const prepass = new HeuristicPrepassCollector();
    for (const t of texts)
        prepass.onMessageText(t);
    const useSemantic = resolveSemanticKeywords(options, prepass, texts);
    const agg = new ReportAggregator(result.filePath, privacy, top, {
        semanticSamples: shouldCollectSemanticSamples(result.records.length),
        estimatedMessages: result.records.length,
    });
    const since = options?.since;
    for (const record of result.records) {
        if (since && !recordOnOrAfter(record, since))
            continue;
        agg.consume(record);
    }
    const usedSemantic = await applySemanticKeywords(agg, useSemantic, false);
    return withKiwiAnalysisFlag(agg.finalize({
        filePath: result.filePath,
        encoding: result.encoding,
        physicalLines: result.physicalLines,
        warningCount: result.warnings.length,
    }, { usedSemanticKeywords: usedSemantic, koreanPrimary: prepass.isPrimarilyKorean() }));
}
function messageTextFromRecord(record) {
    return record.message;
}
async function runStatsPass(filePath, agg, prepass, streamOpts, spoolPath) {
    let meta = null;
    const since = streamOpts?.since;
    let spoolWriter;
    try {
        for await (const event of streamKakaoExport(filePath, streamOpts)) {
            if (event.type === "record") {
                if (since && !recordOnOrAfter(event.record, since))
                    continue;
                prepass.onMessageText(messageTextFromRecord(event.record));
                agg.consume(event.record, { skipKeywords: true });
                if (spoolPath) {
                    if (!spoolWriter)
                        spoolWriter = createWriteStream(spoolPath, { encoding: "utf8" });
                    const line = `${JSON.stringify(event.record)}\n`;
                    if (!spoolWriter.write(line)) {
                        await new Promise((resolve) => spoolWriter.once("drain", resolve));
                    }
                }
            }
            else {
                meta = {
                    filePath: event.meta.filePath,
                    encoding: event.meta.encoding,
                    physicalLines: event.meta.physicalLines,
                    warningCount: event.meta.warnings.length,
                };
            }
        }
    }
    finally {
        if (spoolWriter) {
            await new Promise((resolve, reject) => {
                spoolWriter.end(() => resolve());
                spoolWriter.once("error", reject);
            });
        }
    }
    return meta;
}
export async function runKeywordPassFromSpool(spoolPath, agg, opts) {
    const since = opts?.since;
    const progressEvery = opts?.progressEvery ?? 25_000;
    const onProgress = opts?.onProgress;
    let count = 0;
    for await (const record of iterateSpoolRecords(spoolPath)) {
        if (since && !recordOnOrAfter(record, since))
            continue;
        agg.consume(record, { keywordsOnly: true });
        count += 1;
        if (onProgress && count % progressEvery === 0) {
            onProgress(count);
        }
    }
}
async function runKeywordPass(filePath, agg, streamOpts) {
    const since = streamOpts?.since;
    for await (const event of streamKakaoExport(filePath, streamOpts)) {
        if (event.type === "record") {
            if (since && !recordOnOrAfter(event.record, since))
                continue;
            agg.consume(event.record, { keywordsOnly: true });
        }
    }
}
export async function buildReportFromExportSync(filePath, options) {
    const showProgress = options?.progress !== false;
    if (showProgress)
        resetReportProgress();
    const privacy = options?.privacy ?? "public-masked";
    const top = options?.top ?? DEFAULT_TOP;
    const prepass = new HeuristicPrepassCollector();
    const agg = new ReportAggregator(filePath, privacy, top, {
        semanticSamples: process.env.KCA_NO_SEMANTIC !== "1",
    });
    const useKiwi = process.env.KCA_NO_KIWI !== "1";
    const since = options?.since;
    let messageEstimate;
    if (showProgress) {
        messageEstimate = await estimateKakaoMessageCount(filePath);
        if (since && messageEstimate > 0) {
            console.error("[kca] 진행률 분모는 CSV 전체 메시지 추정치입니다 (--since 필터 전).");
        }
    }
    const progressOpts = (phase, estimated) => {
        const base = since ? { since } : {};
        if (!showProgress)
            return since ? base : undefined;
        return {
            ...base,
            progressEvery: estimated && estimated > 5_000 ? 500 : 250,
            onProgress: (count) => logReportProgress({ phase, current: count, total: estimated }),
        };
    };
    let meta = null;
    const spoolPath = useKiwi ? await createMessageSpoolPath() : null;
    let kiwiAvailableAtAnalysis = false;
    try {
        if (useKiwi) {
            if (showProgress)
                logReportProgress({ phase: "대화 집계", current: 0 });
            meta = await runStatsPass(filePath, agg, prepass, progressOpts("대화 집계", messageEstimate), spoolPath);
            if (!meta)
                throw new Error(`No messages parsed from export: ${filePath}`);
            const estimated = prepass.messageCount;
            if (showProgress)
                logReportProgress({ phase: "대화 집계", current: estimated, total: estimated });
            if (showProgress)
                logReportProgress({ phase: "형태소 엔진 준비", current: 0 });
            const glossary = await loadGlossaryForExport(filePath);
            const userWords = mergeUserWords(glossary, prepass.toUserWords());
            await initKiwiRuntime(userWords);
            kiwiAvailableAtAnalysis = getKiwiRuntime() != null;
            if (showProgress)
                logReportProgress({ phase: "형태소 엔진 준비", current: 1, total: 1 });
            agg.resetKeywordPipeline();
            if (showProgress)
                logReportProgress({ phase: "키워드·주제", current: 0 });
            let spoolReady = false;
            if (spoolPath) {
                try {
                    const st = await stat(spoolPath);
                    spoolReady = st.size > 0;
                }
                catch {
                    spoolReady = false;
                }
            }
            if (spoolPath && spoolReady) {
                const kwProgress = progressOpts("키워드·주제", estimated);
                await runKeywordPassFromSpool(spoolPath, agg, {
                    since,
                    progressEvery: kwProgress?.progressEvery,
                    onProgress: kwProgress?.onProgress,
                });
            }
            else {
                await runKeywordPass(filePath, agg, progressOpts("키워드·주제", estimated));
            }
            if (showProgress) {
                logReportProgress({ phase: "키워드·주제", current: estimated, total: estimated });
            }
        }
        else {
            if (showProgress)
                logReportProgress({ phase: "대화 분석", current: 0 });
            await initKiwiRuntime([]);
            kiwiAvailableAtAnalysis = getKiwiRuntime() != null;
            for await (const event of streamKakaoExport(filePath, progressOpts("대화 분석", messageEstimate))) {
                if (event.type === "record") {
                    if (since && !recordOnOrAfter(event.record, since))
                        continue;
                    prepass.onMessageText(messageTextFromRecord(event.record));
                    agg.consume(event.record);
                }
                else {
                    meta = {
                        filePath: event.meta.filePath,
                        encoding: event.meta.encoding,
                        physicalLines: event.meta.physicalLines,
                        warningCount: event.meta.warnings.length,
                    };
                }
            }
            if (!meta)
                throw new Error(`No messages parsed from export: ${filePath}`);
            if (showProgress) {
                logReportProgress({
                    phase: "대화 분석",
                    current: prepass.messageCount,
                    total: prepass.messageCount,
                });
            }
        }
        const useSemantic = resolveSemanticKeywords(options, prepass, prepass.sampleTexts());
        if (showProgress)
            logReportProgress({ phase: "리포트 마무리", current: 0, total: 1 });
        const usedSemantic = await applySemanticKeywords(agg, useSemantic, showProgress);
        const report = agg.finalize(meta, {
            usedSemanticKeywords: usedSemantic,
            koreanPrimary: prepass.isPrimarilyKorean(),
        });
        if (showProgress) {
            logReportProgress({ phase: "리포트 마무리", current: 1, total: 1 });
            const sem = report.summary.usedSemanticKeywords ? " · 시맨틱" : "";
            console.error(`[kca] 완료 ${report.summary.totalMessages.toLocaleString("ko-KR")}건 · 주제 ${report.topics.length}개${sem}`);
        }
        return { ...report, kiwiAvailableAtAnalysis };
    }
    finally {
        await removeSpool(spoolPath);
    }
}
export async function buildReportFromExport(filePath, options) {
    if (await shouldUseAnalyzeWorker(filePath, options)) {
        return runAnalyzeWorker(filePath, options);
    }
    return buildReportFromExportSync(filePath, options);
}
/** CLI provenance용 — buildReportFromExport와 동일 조건 */
export async function reportUsedAnalyzeWorker(filePath, options) {
    return shouldUseAnalyzeWorker(filePath, options);
}
//# sourceMappingURL=analysis.js.map