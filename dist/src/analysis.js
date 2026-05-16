import { ReportAggregator } from "./aggregator.js";
import { initKiwiRuntime } from "./kiwi-runtime.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker } from "./analyze-pool.js";
import { streamKakaoExport } from "./stream-parser.js";
const DEFAULT_TOP = 30;
/** Kiwi 등 리포트 엔진 준비(스트리밍 분석 전 1회 호출) */
export async function prepareReportEngine() {
    await initKiwiRuntime();
}
export function buildReportData(result, options) {
    const privacy = options?.privacy ?? "public-masked";
    const top = options?.top ?? DEFAULT_TOP;
    const agg = new ReportAggregator(result.filePath, privacy, top);
    for (const record of result.records) {
        agg.consume(record);
    }
    return agg.finalize({
        filePath: result.filePath,
        encoding: result.encoding,
        physicalLines: result.physicalLines,
        warningCount: result.warnings.length,
    });
}
export async function buildReportDataAsync(result, options) {
    await prepareReportEngine();
    return buildReportData(result, options);
}
export async function buildReportFromExportSync(filePath, options) {
    await initKiwiRuntime();
    const privacy = options?.privacy ?? "public-masked";
    const top = options?.top ?? DEFAULT_TOP;
    const agg = new ReportAggregator(filePath, privacy, top);
    let meta = null;
    const streamOpts = options?.progress
        ? {
            progressEvery: 25_000,
            onProgress: (count) => {
                console.error(`[kca] 처리 중… ${count.toLocaleString("ko-KR")}건`);
            },
        }
        : undefined;
    for await (const event of streamKakaoExport(filePath, streamOpts)) {
        if (event.type === "record") {
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
    if (!meta) {
        throw new Error(`No messages parsed from export: ${filePath}`);
    }
    const report = agg.finalize(meta);
    if (options?.progress && report.summary.totalMessages > 0) {
        console.error(`[kca] 처리 완료 ${report.summary.totalMessages.toLocaleString("ko-KR")}건`);
    }
    return report;
}
export async function buildReportFromExport(filePath, options) {
    if (await shouldUseAnalyzeWorker(filePath, options)) {
        return runAnalyzeWorker(filePath, options);
    }
    return buildReportFromExportSync(filePath, options);
}
//# sourceMappingURL=analysis.js.map