import type { UserWord } from "kiwi-nlp";
import { getAnalysisProfileSettings } from "./analysis-profile.js";
import { ReportAggregator, type FinalizeOptions } from "./aggregator.js";
import { HeuristicPrepassCollector } from "./export-prepass.js";
import { loadGlossaryForExport } from "./glossary.js";
import { getKiwiRuntime, initKiwiRuntime } from "./kiwi-runtime.js";
export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { runAnalyzeWorker, shouldUseAnalyzeWorker, type BuildReportOptions } from "./analyze-pool.js";
import { isPrimarilyKoreanMessages } from "./korean-locale.js";
import { logReportProgress, resetReportProgress } from "./report-progress.js";
import { resolveSemanticKeywords, shouldCollectSemanticSamples } from "./semantic-policy.js";
import { resolveSentiment, shouldCollectSentimentSamples } from "./sentiment-policy.js";
import { resolveToxicityMl } from "./toxicity-policy.js";
import { preloadUtteranceMl, runUtteranceMlPass } from "./utterance-features.js";
import { PhaseProfiler } from "./analysis-phase-profile.js";
import { runKeywordPassFromSpoolPooled } from "./kiwi-keyword-pool.js";
import { enrichReportWithLlm } from "./llm-apply.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import { resolveLlmRunPlan } from "./llm-policy.js";
import { AnalysisBudgetTracker } from "./analysis-budget.js";
import type { StreamParseOptions } from "./stream-options.js";
import {
  createMessageSpoolPath,
  iterateSpoolRecords,
  removeSpool,
  type SpoolKeywordPassOptions,
} from "./analysis-spool.js";
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { estimateKakaoMessageCount, streamKakaoExport } from "./stream-parser.js";
import { recordOnOrAfter } from "./report-date-filter.js";
import type { ChatRecord, EncodingName, ParseResult, PrivacyMode, ReportData } from "./types.js";

const DEFAULT_TOP = 30;

export type { BuildReportOptions };

function finalizeProfileOpts(
  options?: BuildReportOptions,
  extra?: FinalizeOptions,
  messageCount?: number,
): FinalizeOptions {
  const settings = getAnalysisProfileSettings(options, messageCount);
  return {
    ...extra,
    useEmbeddingTopics: settings.useEmbeddingTopics,
    semanticSupplementRrfWeight: settings.semanticSupplementRrfWeight,
  };
}

function withKiwiAnalysisFlag(report: ReportData): ReportData {
  return { ...report, kiwiAvailableAtAnalysis: getKiwiRuntime() != null };
}

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


function aggregatorSampleOptions(
  messageCount: number,
  useSemantic: boolean,
  useSentiment: boolean,
): { semanticSamples: boolean; sentimentSamples: boolean; estimatedMessages: number } {
  return {
    semanticSamples: useSemantic && shouldCollectSemanticSamples(messageCount),
    sentimentSamples: useSentiment && shouldCollectSentimentSamples(messageCount),
    estimatedMessages: messageCount,
  };
}

export function buildReportData(result: ParseResult, options?: BuildReportOptions): ReportData {
  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const texts = result.records.map((r) => r.message);
  const korean = isPrimarilyKoreanMessages(texts);
  const agg = new ReportAggregator(result.filePath, privacy, top, {
    semanticSamples: false,
    sentimentSamples: false,
    estimatedMessages: result.records.length,
  });
  const since = options?.since;
  for (const record of result.records) {
    if (since && !recordOnOrAfter(record, since)) continue;
    agg.consume(record);
  }
  return withKiwiAnalysisFlag(
    agg.finalize(
      {
        filePath: result.filePath,
        encoding: result.encoding,
        physicalLines: result.physicalLines,
        warningCount: result.warnings.length,
      },
      finalizeProfileOpts(options, { koreanPrimary: korean }, result.records.length),
    ),
  );
}

export async function buildReportDataAsync(
  result: ParseResult,
  options?: BuildReportOptions,
): Promise<ReportData> {
  await prepareReportEngine();
  const privacy = options?.privacy ?? "public-masked";
  const top = options?.top ?? DEFAULT_TOP;
  const texts = result.records.map((r) => r.message);
  const prepass = new HeuristicPrepassCollector();
  for (const t of texts) prepass.onMessageText(t);
  const useSemantic = resolveSemanticKeywords(options, prepass, texts);
  const useSentiment = resolveSentiment(options, prepass, texts);
  const useToxicity = resolveToxicityMl(options, prepass, texts);
  const agg = new ReportAggregator(
    result.filePath,
    privacy,
    top,
    aggregatorSampleOptions(result.records.length, useSemantic, useSentiment),
  );
  const since = options?.since;
  for (const record of result.records) {
    if (since && !recordOnOrAfter(record, since)) continue;
    agg.consume(record);
  }
  const { usedSemantic, usedSentiment, usedToxicity } = await runUtteranceMlPass(agg, {
    useSentiment: useSentiment,
    useSemantic: useSemantic,
    useToxicity: useToxicity,
    showProgress: false,
    buildOptions: options,
    messageCount: result.records.length,
  });
  return withKiwiAnalysisFlag(
    agg.finalize(
      {
        filePath: result.filePath,
        encoding: result.encoding,
        physicalLines: result.physicalLines,
        warningCount: result.warnings.length,
      },
      finalizeProfileOpts(
        options,
        {
          usedSemanticKeywords: usedSemantic,
          usedSentimentAnalysis: usedSentiment,
          usedToxicityAnalysis: usedToxicity,
          koreanPrimary: prepass.isPrimarilyKorean(),
        },
        result.records.length,
      ),
    ),
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
  spoolPath?: string | null,
): Promise<{ filePath: string; encoding: EncodingName; physicalLines: number; warningCount: number } | null> {
  let meta: {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
  } | null = null;

  const since = streamOpts?.since;
  let spoolWriter: ReturnType<typeof createWriteStream> | undefined;
  try {
    for await (const event of streamKakaoExport(filePath, streamOpts)) {
      if (event.type === "record") {
        if (since && !recordOnOrAfter(event.record, since)) continue;
        prepass.onMessageText(messageTextFromRecord(event.record));
        agg.consume(event.record, { skipKeywords: true, collectSamples: true });
        if (spoolPath) {
          if (!spoolWriter) spoolWriter = createWriteStream(spoolPath, { encoding: "utf8" });
          const line = `${JSON.stringify(event.record)}\n`;
          if (!spoolWriter.write(line)) {
            await new Promise<void>((resolve) => spoolWriter!.once("drain", resolve));
          }
        }
      } else {
        meta = {
          filePath: event.meta.filePath,
          encoding: event.meta.encoding,
          physicalLines: event.meta.physicalLines,
          warningCount: event.meta.warnings.length,
        };
      }
    }
  } finally {
    if (spoolWriter) {
      await new Promise<void>((resolve, reject) => {
        spoolWriter!.end(() => resolve());
        spoolWriter!.once("error", reject);
      });
    }
  }
  return meta;
}

export type { SpoolKeywordPassOptions };

export async function runKeywordPassFromSpool(
  spoolPath: string,
  agg: ReportAggregator,
  opts?: SpoolKeywordPassOptions,
): Promise<void> {
  const since = opts?.since;
  const progressEvery = opts?.progressEvery ?? 25_000;
  const onProgress = opts?.onProgress;
  let count = 0;
  for await (const record of iterateSpoolRecords(spoolPath)) {
    if (since && !recordOnOrAfter(record, since)) continue;
    agg.consume(record, { keywordsOnly: true });
    count += 1;
    if (onProgress && count % progressEvery === 0) {
      onProgress(count);
    }
  }
}

async function runKeywordPass(
  filePath: string,
  agg: ReportAggregator,
  streamOpts?: StreamParseOptions,
): Promise<void> {
  const since = streamOpts?.since;
  for await (const event of streamKakaoExport(filePath, streamOpts)) {
    if (event.type === "record") {
      if (since && !recordOnOrAfter(event.record, since)) continue;
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
  const prepass = new HeuristicPrepassCollector();
  const useKiwi = process.env.KCA_NO_KIWI !== "1";

  const since = options?.since;
  let messageEstimate: number | undefined;
  try {
    messageEstimate = await estimateKakaoMessageCount(filePath);
  } catch {
    messageEstimate = undefined;
  }
  if (showProgress && since && messageEstimate && messageEstimate > 0) {
    console.error("[kca] 진행률 분모는 CSV 전체 메시지 추정치입니다 (--since 필터 전).");
  }

  const agg = new ReportAggregator(filePath, privacy, top, {
    semanticSamples: process.env.KCA_NO_SEMANTIC !== "1",
    sentimentSamples: process.env.KCA_NO_SENTIMENT !== "1",
    estimatedMessages: messageEstimate,
  });
  const progressOpts = (phase: string, estimated?: number): StreamParseOptions | undefined => {
    const base: StreamParseOptions = since ? { since } : {};
    if (!showProgress) return since ? base : undefined;
    return {
      ...base,
      progressEvery: estimated && estimated > 5_000 ? 500 : 250,
      onProgress: (count) => logReportProgress({ phase, current: count, total: estimated }),
    };
  };

  let meta: {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
  } | null = null;

  const spoolPath = useKiwi ? await createMessageSpoolPath() : null;
  let kiwiAvailableAtAnalysis = false;
  const phaseProfiler = new PhaseProfiler();
  let preset = resolvePresetNameWithAuto(options, messageEstimate);
  const profileMachine = probeMachineProfileSync();
  let llmPlan = resolveLlmRunPlan({ preset, profile: profileMachine, messageCount: messageEstimate });
  let budget = new AnalysisBudgetTracker(
    preset,
    messageEstimate ?? 0,
    profileMachine,
    llmPlan.size,
  );
  try {
  if (useKiwi) {
    if (showProgress) logReportProgress({ phase: "대화 집계", current: 0 });
    phaseProfiler.start("stats_pass");
    meta = await runStatsPass(
      filePath,
      agg,
      prepass,
      progressOpts("대화 집계", messageEstimate),
      spoolPath,
    );
    phaseProfiler.end("stats_pass");
    if (!meta) throw new Error(`No messages parsed from export: ${filePath}`);

    const estimated = prepass.messageCount;
    agg.ensureSampleCaps(estimated);
    agg.markSamplesCollectedInStatsPass();
    if (showProgress) logReportProgress({ phase: "대화 집계", current: estimated, total: estimated });

    preset = resolvePresetNameWithAuto(options, estimated);
    llmPlan = resolveLlmRunPlan({ preset, profile: profileMachine, messageCount: estimated });
    budget = new AnalysisBudgetTracker(preset, estimated, profileMachine, llmPlan.size);

    let useSemanticOverlap = resolveSemanticKeywords(options, prepass, prepass.sampleTexts());
    let useSentimentOverlap = resolveSentiment(options, prepass, prepass.sampleTexts());
    let useToxicityOverlap = resolveToxicityMl(options, prepass, prepass.sampleTexts());
    if (useSemanticOverlap && budget.shouldSkip("semantic")) useSemanticOverlap = false;
    if (useSentimentOverlap && budget.shouldSkip("sentiment")) useSentimentOverlap = false;
    if (useToxicityOverlap && budget.shouldSkip("sentiment")) useToxicityOverlap = false;

    if (showProgress) logReportProgress({ phase: "형태소 엔진 준비", current: 0 });

    const runKiwiAndKeywordPass = async (): Promise<void> => {
      phaseProfiler.start("kiwi_prep");
      const glossary = await loadGlossaryForExport(filePath);
      const userWords = mergeUserWords(glossary, prepass.toUserWords());
      const warmups: Promise<unknown>[] = [initKiwiRuntime(userWords)];
      const mlOpts = { ...options, preset: resolvePresetNameWithAuto(options, estimated) };
      if (useSemanticOverlap || useSentimentOverlap || useToxicityOverlap) {
        warmups.push(
          preloadUtteranceMl({
            useSentiment: useSentimentOverlap,
            useSemantic: useSemanticOverlap,
            useToxicity: useToxicityOverlap,
            showProgress: false,
            buildOptions: mlOpts,
            messageCount: estimated,
          }),
        );
      }
      await Promise.all(warmups);
      kiwiAvailableAtAnalysis = getKiwiRuntime() != null;
      phaseProfiler.end("kiwi_prep");
      if (showProgress) logReportProgress({ phase: "형태소 엔진 준비", current: 1, total: 1 });

      agg.resetKeywordPipeline();
      if (showProgress) logReportProgress({ phase: "키워드·주제", current: 0 });
      phaseProfiler.start("keyword_pass");
      let spoolReady = false;
      if (spoolPath) {
        try {
          const st = await stat(spoolPath);
          spoolReady = st.size > 0;
        } catch {
          spoolReady = false;
        }
      }
      const kwProgress = progressOpts("키워드·주제", estimated);
      const kwOpts: SpoolKeywordPassOptions = {
        since,
        progressEvery: kwProgress?.progressEvery,
        onProgress: kwProgress?.onProgress,
      };
      if (spoolPath && spoolReady) {
        await runKeywordPassFromSpoolPooled(spoolPath, agg, userWords, estimated, kwOpts);
      } else {
        await runKeywordPass(filePath, agg, progressOpts("키워드·주제", estimated));
      }
      phaseProfiler.end("keyword_pass");
      if (showProgress) {
        logReportProgress({ phase: "키워드·주제", current: estimated, total: estimated });
      }
    };

    phaseProfiler.start("ml_overlap");
    const [, mlOverlap] = await Promise.all([
      runKiwiAndKeywordPass(),
      runUtteranceMlPass(agg, {
        useSentiment: useSentimentOverlap,
        useSemantic: useSemanticOverlap,
        useToxicity: useToxicityOverlap,
        showProgress,
        buildOptions: options,
        messageCount: estimated,
      }),
    ]);
    const {
      usedSemantic: usedSemanticOverlap,
      usedSentiment: usedSentimentOverlap,
      usedToxicity: usedToxicityOverlap,
    } = mlOverlap;
    phaseProfiler.end("ml_overlap");

    if (showProgress) logReportProgress({ phase: "리포트 마무리", current: 0, total: 1 });

    let report = agg.finalize(
      meta!,
      finalizeProfileOpts(
        options,
        {
          usedSemanticKeywords: usedSemanticOverlap,
          usedSentimentAnalysis: usedSentimentOverlap,
          usedToxicityAnalysis: usedToxicityOverlap,
          koreanPrimary: prepass.isPrimarilyKorean(),
        },
        prepass.messageCount,
      ),
    );

    llmPlan = resolveLlmRunPlan({ preset, profile: profileMachine, messageCount: prepass.messageCount });
    phaseProfiler.start("llm");
    if (llmPlan.enabled && !budget.shouldSkip("llm")) {
      if (showProgress) logReportProgress({ phase: "LLM 서사", current: 0, total: 1 });
      report = await enrichReportWithLlm(report, options);
      if (showProgress) logReportProgress({ phase: "LLM 서사", current: 1, total: 1 });
    }
    phaseProfiler.end("llm");

    if (showProgress) {
      logReportProgress({ phase: "리포트 마무리", current: 1, total: 1 });
      const sem = report.summary.usedSemanticKeywords ? " · 시맨틱" : "";
      const sent = report.summary.usedSentimentAnalysis ? " · 감정" : "";
      const tox = report.summary.usedToxicityAnalysis ? " · 독성" : "";
      const llm = report.summary.usedLlmAnalysis ? " · LLM" : "";
      console.error(
        `[kca] 완료 ${report.summary.totalMessages.toLocaleString("ko-KR")}건 · 주제 ${report.topics.length}개${sem}${sent}${tox}${llm}`,
      );
    }

    phaseProfiler.logSummary(prepass.messageCount);
    return { ...report, kiwiAvailableAtAnalysis };
  } else {
    if (showProgress) logReportProgress({ phase: "대화 분석", current: 0 });
    await initKiwiRuntime([]);
    kiwiAvailableAtAnalysis = getKiwiRuntime() != null;
    for await (const event of streamKakaoExport(filePath, progressOpts("대화 분석", messageEstimate))) {
      if (event.type === "record") {
        if (since && !recordOnOrAfter(event.record, since)) continue;
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
    agg.ensureSampleCaps(prepass.messageCount);
    if (showProgress) {
      logReportProgress({
        phase: "대화 분석",
        current: prepass.messageCount,
        total: prepass.messageCount,
      });
    }
  }

  preset = resolvePresetNameWithAuto(options, prepass.messageCount);
  llmPlan = resolveLlmRunPlan({ preset, profile: profileMachine, messageCount: prepass.messageCount });
  budget = new AnalysisBudgetTracker(preset, prepass.messageCount, profileMachine, llmPlan.size);

  let useSemantic = resolveSemanticKeywords(options, prepass, prepass.sampleTexts());
  let useSentiment = resolveSentiment(options, prepass, prepass.sampleTexts());
  let useToxicity = resolveToxicityMl(options, prepass, prepass.sampleTexts());
  if (useSemantic && budget.shouldSkip("semantic")) useSemantic = false;
  if (useSentiment && budget.shouldSkip("sentiment")) useSentiment = false;
  if (useToxicity && budget.shouldSkip("sentiment")) useToxicity = false;

  if (showProgress) logReportProgress({ phase: "리포트 마무리", current: 0, total: 1 });

  phaseProfiler.start("ml");
  const mlResult = await runUtteranceMlPass(agg, {
    useSentiment: useSentiment,
    useSemantic: useSemantic,
    useToxicity: useToxicity,
    showProgress,
    buildOptions: options,
    messageCount: prepass.messageCount,
  });
  const { usedSemantic, usedSentiment, usedToxicity } = mlResult;
  phaseProfiler.end("ml");

  let report = agg.finalize(
    meta!,
    finalizeProfileOpts(
      options,
      {
        usedSemanticKeywords: usedSemantic,
        usedSentimentAnalysis: usedSentiment,
        usedToxicityAnalysis: usedToxicity,
        koreanPrimary: prepass.isPrimarilyKorean(),
      },
      prepass.messageCount,
    ),
  );

  phaseProfiler.start("llm");
  if (llmPlan.enabled && !budget.shouldSkip("llm")) {
    if (showProgress) logReportProgress({ phase: "LLM 서사", current: 0, total: 1 });
    report = await enrichReportWithLlm(report, options);
    if (showProgress) logReportProgress({ phase: "LLM 서사", current: 1, total: 1 });
  }
  phaseProfiler.end("llm");

  if (showProgress) {
    logReportProgress({ phase: "리포트 마무리", current: 1, total: 1 });
    const sem = report.summary.usedSemanticKeywords ? " · 시맨틱" : "";
    const sent = report.summary.usedSentimentAnalysis ? " · 감정" : "";
    const tox = report.summary.usedToxicityAnalysis ? " · 독성" : "";
    const llm = report.summary.usedLlmAnalysis ? " · LLM" : "";
    console.error(
      `[kca] 완료 ${report.summary.totalMessages.toLocaleString("ko-KR")}건 · 주제 ${report.topics.length}개${sem}${sent}${tox}${llm}`,
    );
  }

  phaseProfiler.logSummary(prepass.messageCount);
  return { ...report, kiwiAvailableAtAnalysis };
  } finally {
    await removeSpool(spoolPath);
  }
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

/** CLI provenance용 — buildReportFromExport와 동일 조건 */
export async function reportUsedAnalyzeWorker(
  filePath: string,
  options?: BuildReportOptions,
): Promise<boolean> {
  return shouldUseAnalyzeWorker(filePath, options);
}
