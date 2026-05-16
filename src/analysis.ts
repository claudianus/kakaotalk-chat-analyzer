import type { UserWord } from "kiwi-nlp";
import { ReportAggregator } from "./aggregator.js";
import { HeuristicPrepassCollector } from "./export-prepass.js";
import { loadGlossaryForExport } from "./glossary.js";
import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { initKiwiRuntime } from "./kiwi-runtime.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker, type BuildReportOptions } from "./analyze-pool.js";
import { logReportProgress, resetReportProgress } from "./report-progress.js";
import { extractSemanticKeywords } from "./semantic-keywords.js";
import type { StreamParseOptions } from "./stream-options.js";
import { streamKakaoExport } from "./stream-parser.js";
import type { EncodingName, ParseResult, PrivacyMode, ReportData } from "./types.js";

const DEFAULT_TOP = 30;

export type { BuildReportOptions };

function mergeUserWords(...lists: UserWord[][]): UserWord[] {
  const seen = new Set<string>();
  const out: UserWord[] = [];
  for (const list of lists) {
    for (const uw of list) {
      if (seen.has(uw.word)) continue;
      seen.add(uw.word);
      out.push(uw);
    }
  }
  return out.slice(0, 96);
}

/** Kiwi 등 리포트 엔진 준비(스트리밍 분석 전 1회 호출) */
export async function prepareReportEngine(): Promise<void> {
  await initKiwiRuntime();
}

async function applySemanticKeywordsIfRequested(
  agg: ReportAggregator,
  options: BuildReportOptions | undefined,
  showProgress: boolean,
): Promise<boolean> {
  if (!options?.semanticKeywords || process.env.KCA_NO_SEMANTIC === "1") return false;

  const samples = agg.drainSemanticSamples();
  if (samples.length < 48) return false;

  if (showProgress) logReportProgress({ phase: "시맨틱 키워드", current: 0 });
  const items = await extractSemanticKeywords(samples, {
    stopwords: buildKeywordStopwords(),
    onProgress: showProgress
      ? (current, total) => logReportProgress({ phase: "시맨틱 키워드", current, total })
      : undefined,
  });
  if (items.length > 0) agg.applySemanticKeywordBoost(items);
  return items.length > 0;
}

export function buildReportData(result: ParseResult, options?: BuildReportOptions): ReportData {
  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const agg = new ReportAggregator(result.filePath, privacy, top, {
    semanticSamples: options?.semanticKeywords === true,
  });
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
  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const agg = new ReportAggregator(result.filePath, privacy, top, {
    semanticSamples: options?.semanticKeywords === true,
  });
  for (const record of result.records) {
    agg.consume(record);
  }
  const usedSemantic = await applySemanticKeywordsIfRequested(agg, options, false);
  return agg.finalize(
    {
      filePath: result.filePath,
      encoding: result.encoding,
      physicalLines: result.physicalLines,
      warningCount: result.warnings.length,
    },
    { usedSemanticKeywords: usedSemantic },
  );
}

function messageTextFromRecord(record: { message: string }): string {
  return record.message;
}

async function runStatsPass(
  filePath: string,
  agg: ReportAggregator,
  prepass: HeuristicPrepassCollector,
  streamOpts?: StreamParseOptions,
): Promise<{ filePath: string; encoding: EncodingName; physicalLines: number; warningCount: number } | null> {
  let meta: {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
  } | null = null;

  for await (const event of streamKakaoExport(filePath, streamOpts)) {
    if (event.type === "record") {
      prepass.onMessageText(messageTextFromRecord(event.record));
      agg.consume(event.record, { skipKeywords: true });
    } else {
      meta = {
        filePath: event.meta.filePath,
        encoding: event.meta.encoding,
        physicalLines: event.meta.physicalLines,
        warningCount: event.meta.warnings.length,
      };
    }
  }
  return meta;
}

async function runKeywordPass(
  filePath: string,
  agg: ReportAggregator,
  streamOpts?: StreamParseOptions,
): Promise<void> {
  for await (const event of streamKakaoExport(filePath, streamOpts)) {
    if (event.type === "record") {
      agg.consume(event.record, { keywordsOnly: true });
    }
  }
}

export async function buildReportFromExportSync(
  filePath: string,
  options?: BuildReportOptions,
): Promise<ReportData> {
  const showProgress = options?.progress !== false;
  if (showProgress) resetReportProgress();

  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const agg = new ReportAggregator(filePath, privacy, top, {
    semanticSamples: options?.semanticKeywords === true,
  });
  const prepass = new HeuristicPrepassCollector();
  const useKiwi = process.env.KCA_NO_KIWI !== "1";

  const progressOpts = (phase: string, estimated?: number): StreamParseOptions | undefined =>
    showProgress
      ? {
          progressEvery: estimated && estimated > 5_000 ? 500 : 250,
          onProgress: (count) => logReportProgress({ phase, current: count, total: estimated }),
        }
      : undefined;

  let meta: {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
  } | null = null;

  if (useKiwi) {
    if (showProgress) logReportProgress({ phase: "대화 집계", current: 0 });
    meta = await runStatsPass(filePath, agg, prepass, progressOpts("대화 집계"));
    if (!meta) throw new Error(`No messages parsed from export: ${filePath}`);

    const estimated = prepass.messageCount;
    if (showProgress) logReportProgress({ phase: "대화 집계", current: estimated, total: estimated });

    if (showProgress) logReportProgress({ phase: "형태소 엔진 준비", current: 0 });
    const glossary = await loadGlossaryForExport(filePath);
    const userWords = mergeUserWords(glossary, prepass.toUserWords());
    await initKiwiRuntime(userWords);
    if (showProgress) logReportProgress({ phase: "형태소 엔진 준비", current: 1, total: 1 });

    agg.resetKeywordPipeline();
    if (showProgress) logReportProgress({ phase: "키워드·주제", current: 0 });
    await runKeywordPass(filePath, agg, progressOpts("키워드·주제", estimated));
    if (showProgress) {
      logReportProgress({ phase: "키워드·주제", current: estimated, total: estimated });
    }
  } else {
    if (showProgress) logReportProgress({ phase: "대화 분석", current: 0 });
    await initKiwiRuntime([]);
    for await (const event of streamKakaoExport(filePath, progressOpts("대화 분석"))) {
      if (event.type === "record") {
        prepass.onMessageText(messageTextFromRecord(event.record));
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
    if (!meta) throw new Error(`No messages parsed from export: ${filePath}`);
    if (showProgress) {
      logReportProgress({
        phase: "대화 분석",
        current: prepass.messageCount,
        total: prepass.messageCount,
      });
    }
  }

  if (showProgress) logReportProgress({ phase: "리포트 마무리", current: 0, total: 1 });

  const usedSemantic = await applySemanticKeywordsIfRequested(agg, options, showProgress);
  const report = agg.finalize(meta, { usedSemanticKeywords: usedSemantic });

  if (showProgress) {
    logReportProgress({ phase: "리포트 마무리", current: 1, total: 1 });
    const sem = report.summary.usedSemanticKeywords ? " · 시맨틱" : "";
    console.error(
      `[kca] 완료 ${report.summary.totalMessages.toLocaleString("ko-KR")}건 · 주제 ${report.topics.length}개${sem}`,
    );
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
