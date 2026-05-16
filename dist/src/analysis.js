import { ReportAggregator } from "./aggregator.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker } from "./analyze-pool.js";
import { streamKakaoExport } from "./stream-parser.js";
const DEFAULT_TOP = 30;
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
export async function buildReportFromExportSync(filePath, options) {
    const privacy = options?.privacy ?? "public-masked";
    const top = options?.top ?? DEFAULT_TOP;
    const agg = new ReportAggregator(filePath, privacy, top);
    let meta = null;
    for await (const event of streamKakaoExport(filePath)) {
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
    return agg.finalize(meta);
}
export async function buildReportFromExport(filePath, options) {
    if (await shouldUseAnalyzeWorker(filePath, options)) {
        return runAnalyzeWorker(filePath, options);
    }
    return buildReportFromExportSync(filePath, options);
}
//# sourceMappingURL=analysis.js.map