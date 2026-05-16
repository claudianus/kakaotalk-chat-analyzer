import { ReportAggregator } from "./aggregator.js";
import { initKiwiRuntime } from "./kiwi-runtime.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker, type BuildReportOptions } from "./analyze-pool.js";
import type { StreamParseOptions } from "./stream-options.js";
import { streamKakaoExport } from "./stream-parser.js";
import type { EncodingName, ParseResult, PrivacyMode, ReportData } from "./types.js";

const DEFAULT_TOP = 30;

export type { BuildReportOptions };

export function buildReportData(result: ParseResult, options?: BuildReportOptions): ReportData {
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

export async function buildReportFromExportSync(
  filePath: string,
  options?: BuildReportOptions,
): Promise<ReportData> {
  await initKiwiRuntime();
  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const agg = new ReportAggregator(filePath, privacy, top);
  let meta: { filePath: string; encoding: EncodingName; physicalLines: number; warningCount: number } | null =
    null;

  const streamOpts: StreamParseOptions | undefined = options?.progress
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
    } else {
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

export async function buildReportFromExport(
  filePath: string,
  options?: BuildReportOptions,
): Promise<ReportData> {
  if (await shouldUseAnalyzeWorker(filePath, options)) {
    return runAnalyzeWorker(filePath, options);
  }
  return buildReportFromExportSync(filePath, options);
}
