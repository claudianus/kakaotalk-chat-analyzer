import { stat } from "node:fs/promises";
import { ReportAggregator } from "./aggregator.js";
import { runExportPrepass } from "./export-prepass.js";
import { initKiwiRuntime } from "./kiwi-runtime.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker, type BuildReportOptions } from "./analyze-pool.js";
import { logReportProgress, resetReportProgress } from "./report-progress.js";
import type { StreamParseOptions } from "./stream-options.js";
import { streamKakaoExport } from "./stream-parser.js";
import type { EncodingName, ParseResult, PrivacyMode, ReportData } from "./types.js";

const DEFAULT_TOP = 30;
const PREPASS_MIN_BYTES = 200_000;

export type { BuildReportOptions };

/** Kiwi 등 리포트 엔진 준비(스트리밍 분석 전 1회 호출) */
export async function prepareReportEngine(): Promise<void> {
  await initKiwiRuntime();
}

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

export async function buildReportDataAsync(
  result: ParseResult,
  options?: BuildReportOptions,
): Promise<ReportData> {
  await prepareReportEngine();
  return buildReportData(result, options);
}

async function prepareKiwiAndEstimate(
  filePath: string,
  showProgress: boolean,
): Promise<number | undefined> {
  let estimated: number | undefined;
  let userWords: import("kiwi-nlp").UserWord[] = [];

  const needsPrepass =
    process.env.KCA_NO_KIWI !== "1" ||
    showProgress;

  if (needsPrepass) {
    try {
      const { size } = await stat(filePath);
      if (size >= PREPASS_MIN_BYTES || showProgress) {
        if (showProgress) logReportProgress({ phase: "사전 스캔", current: 0 });
        const prepass = await runExportPrepass(filePath);
        estimated = prepass.messageCount;
        userWords = prepass.userWords;
        if (showProgress) {
          logReportProgress({
            phase: "사전 스캔",
            current: estimated,
            total: estimated,
          });
        }
      }
    } catch {
      estimated = undefined;
    }
  }

  if (showProgress) logReportProgress({ phase: "형태소 엔진 준비", current: 0 });
  await initKiwiRuntime(userWords);
  if (showProgress) logReportProgress({ phase: "형태소 엔진 준비", current: 1, total: 1 });

  return estimated;
}

export async function buildReportFromExportSync(
  filePath: string,
  options?: BuildReportOptions,
): Promise<ReportData> {
  const showProgress = options?.progress !== false;
  if (showProgress) resetReportProgress();

  const estimated = await prepareKiwiAndEstimate(filePath, showProgress);

  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const agg = new ReportAggregator(filePath, privacy, top);
  let meta: { filePath: string; encoding: EncodingName; physicalLines: number; warningCount: number } | null =
    null;

  const streamOpts: StreamParseOptions | undefined = showProgress
    ? {
        progressEvery: estimated && estimated > 5_000 ? 500 : 250,
        onProgress: (count) => {
          logReportProgress({
            phase: "대화 분석",
            current: count,
            total: estimated,
          });
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

  if (showProgress) {
    const total = estimated ?? meta.physicalLines;
    logReportProgress({ phase: "대화 분석", current: total, total });
    logReportProgress({ phase: "주제·리포트 마무리", current: 0, total: 1 });
  }

  const report = agg.finalize(meta);

  if (showProgress) {
    logReportProgress({ phase: "주제·리포트 마무리", current: 1, total: 1 });
    console.error(`[kca] 완료 ${report.summary.totalMessages.toLocaleString("ko-KR")}건 · 주제 ${report.topics.length}개`);
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
