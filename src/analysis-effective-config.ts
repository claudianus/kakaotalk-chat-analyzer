import type { BuildReportOptions } from "./analyze-pool.js";
import {
  analysisBudgetMs,
  memoryHeadroomGb,
  type MachineProfile,
  probeMachineProfileSync,
} from "./analysis-capability.js";
import { formatMemoryLine } from "./memory-probe.js";
import {
  autoPresetFromMachine,
  getPresetEffectiveFlags,
  presetForcesSemanticOff,
  presetForcesSentimentOff,
  resolvePresetName,
  resolvePresetNameWithAuto,
  type AnalysisPresetName,
} from "./analysis-preset.js";
import { getAnalysisProfileSettings } from "./analysis-profile.js";
import { resolveLlmRunPlan, qwenModelIdForPlan } from "./llm-policy.js";
import { qwen35DisplayLabel, type Qwen35Size } from "./llm-qwen35.js";
import type { BuildReportProvenanceOptions } from "./report-provenance.js";
import { parseKcaInvokerEnv } from "./report-provenance.js";
import { resolveTopicModel } from "./report-provenance.js";
import {
  effectiveSemanticSampleCap,
  semanticEmbeddingModelId,
} from "./semantic-policy.js";
import { sentimentModelId } from "./sentiment-policy.js";
import { resolveToxicityModelId } from "./ml/registry.js";
import type { PrivacyMode, ReportData } from "./types.js";

export type PresetSource = "cli" | "env" | "auto-ram" | "auto-corpus" | "legacy-fast";

export interface PhaseEffectiveState {
  requested: boolean | "auto";
  used: boolean;
  model?: string;
  sampleCap?: number;
  skippedReason?: string;
}

export interface AnalysisEffectiveConfig {
  preset: AnalysisPresetName;
  presetSource: PresetSource;
  profile: "quality" | "fast";
  privacy: PrivacyMode;
  top: number;
  since?: string;
  workerRequested: boolean | "auto";
  workerUsed: boolean;
  semantic: PhaseEffectiveState;
  sentiment: PhaseEffectiveState;
  encoderPlane: {
    sentiment: string;
    embedding: string;
    toxicity: string;
  };
  llm: {
    enabled: boolean;
    size?: Qwen35Size;
    reason: string;
    used: boolean;
    modelId?: string;
    skippedReason?: string;
  };
  topicModel: "graph" | "embedding" | "hybrid";
  embeddingTopics: boolean;
  budgetMs: number;
  envOverrides: string[];
  invokedVia?: { name: "kcachat"; version: string };
  messageCount: number;
  machine: Pick<MachineProfile, "freeMemGb" | "availableMemGb" | "totalMemGb" | "gpu">;
}

export interface CliPipelineOptions {
  privacy: PrivacyMode;
  top: number;
  since?: string;
  preset?: AnalysisPresetName;
  worker?: boolean;
  semanticKeywords?: boolean;
  sentiment?: boolean;
}

function collectEnvOverrides(): string[] {
  const keys = [
    "KCA_PRESET",
    "KCA_PROFILE",
    "KCA_NO_SEMANTIC",
    "KCA_SEMANTIC",
    "KCA_SEMANTIC_DEFAULT",
    "KCA_SEMANTIC_MODEL",
    "KCA_NO_SENTIMENT",
    "KCA_SENTIMENT",
    "KCA_SENTIMENT_DEFAULT",
    "KCA_SENTIMENT_MODEL",
    "KCA_NO_TOXICITY",
    "KCA_TOXICITY",
    "KCA_TOXICITY_MODEL",
    "KCA_LLM",
    "KCA_LLM_MODEL",
    "KCA_LLM_MOCK",
    "KCA_LLM_BACKEND",
    "KCA_LLM_GPU",
    "KCA_LLM_TIMEOUT_MS",
    "KCA_LLM_RAM_RESERVE_GB",
    "KCA_DEBUG_LLM",
    "KCA_EMBEDDING_TOPICS",
    "KCA_INVOKER",
    "KCA_MEMORY_PROBE",
  ];
  const out: string[] = [];
  for (const key of keys) {
    const v = process.env[key];
    if (v !== undefined && v !== "") out.push(`${key}=${v}`);
  }
  return out;
}

export function resolvePresetSource(
  cliPreset: AnalysisPresetName | undefined,
  worker: boolean | undefined,
  messageCount: number,
  machine: MachineProfile,
): PresetSource {
  if (cliPreset) return "cli";
  const env = process.env.KCA_PRESET?.trim().toLowerCase();
  if (env === "speed" || env === "balanced" || env === "quality" || env === "custom") return "env";
  if (worker === true || process.env.KCA_PROFILE === "fast") return "legacy-fast";
  const auto = autoPresetFromMachine(machine, messageCount);
  const ramOnly = autoPresetFromMachine(machine, 0);
  if (auto !== ramOnly) return "auto-corpus";
  return "auto-ram";
}

function presetSourceLabel(source: PresetSource): string {
  const labels: Record<PresetSource, string> = {
    cli: "CLI --preset",
    env: "환경 변수 KCA_PRESET",
    "auto-ram": "RAM 기준 자동",
    "auto-corpus": "RAM·메시지 수 기준 자동",
    "legacy-fast": "CLI --fast / KCA_PROFILE=fast",
  };
  return labels[source];
}

function resolveWorkerRequested(worker?: boolean): boolean | "auto" {
  if (worker === false) return false;
  if (worker === true) return true;
  return "auto";
}

function resolveSemanticRequested(semanticKeywords?: boolean): boolean | "auto" {
  if (semanticKeywords === false) return false;
  if (semanticKeywords === true) return true;
  return "auto";
}

function resolveSentimentRequested(sentiment?: boolean): boolean | "auto" {
  if (sentiment === false) return false;
  if (sentiment === true) return true;
  return "auto";
}

function inferSemanticSkipReason(
  options: BuildReportOptions | undefined,
  preset: AnalysisPresetName,
  used: boolean,
): string | undefined {
  if (used) return undefined;
  if (process.env.KCA_NO_SEMANTIC === "1") return "KCA_NO_SEMANTIC=1";
  if (options?.semanticKeywords === false) return "CLI --no-semantic-keywords";
  if (presetForcesSemanticOff(options)) return `${preset} preset`;
  if (process.env.KCA_SEMANTIC === "0") return "KCA_SEMANTIC=0";
  if (process.env.KCA_SEMANTIC_DEFAULT === "opt-in") return "KCA_SEMANTIC_DEFAULT=opt-in";
  if (options?.semanticKeywords !== true && process.env.KCA_SEMANTIC !== "1") {
    return "auto: 한국어 비중·샘플 조건 미충족 또는 실행 중 오류";
  }
  return "실행 중 오류 또는 샘플 부족";
}

function inferSentimentSkipReason(
  options: BuildReportOptions | undefined,
  preset: AnalysisPresetName,
  used: boolean,
  messageCount: number,
): string | undefined {
  if (used) return undefined;
  if (process.env.KCA_NO_SENTIMENT === "1") return "KCA_NO_SENTIMENT=1";
  if (options?.sentiment === false) return "CLI --no-sentiment";
  if (presetForcesSentimentOff(options, messageCount)) return `${preset} preset (RAM 부족)`;
  if (process.env.KCA_SENTIMENT === "0") return "KCA_SENTIMENT=0";
  if (process.env.KCA_SENTIMENT_DEFAULT === "opt-in") return "KCA_SENTIMENT_DEFAULT=opt-in";
  if (options?.sentiment !== true && process.env.KCA_SENTIMENT !== "1") {
    return "auto: 한국어 비중·샘플 조건 미충족 또는 실행 중 오류";
  }
  return "실행 중 오류 또는 샘플 부족";
}

function inferLlmSkipReason(
  used: boolean,
  plan: ReturnType<typeof resolveLlmRunPlan>,
  summarySkippedReason?: string,
): string | undefined {
  if (used) return undefined;
  if (summarySkippedReason?.trim()) return summarySkippedReason.trim();
  if (!plan.enabled) return plan.reason;
  return "GGUF 없음·예산 부족·추론 실패 또는 JSON 파싱 실패";
}

function llmProvenanceLabel(plan: ReturnType<typeof resolveLlmRunPlan>): string {
  if (!plan.enabled || !plan.size) return "off";
  return `${qwen35DisplayLabel(plan.size)} · ${plan.reason}`;
}

/** 집계 완료 후 실제 적용 설정 */
export function buildAnalysisEffectiveConfig(
  data: ReportData,
  cli: CliPipelineOptions,
  machine?: MachineProfile,
): AnalysisEffectiveConfig {
  const profileMachine = machine ?? probeMachineProfileSync();
  const buildOpts: BuildReportOptions = {
    preset: cli.preset,
    worker: cli.worker,
    semanticKeywords: cli.semanticKeywords,
    sentiment: cli.sentiment,
    since: cli.since,
  };
  const messageCount = data.summary.totalMessages;
  const preset = resolvePresetNameWithAuto(buildOpts, messageCount);
  const presetSource = resolvePresetSource(cli.preset, cli.worker, messageCount, profileMachine);
  const profileSettings = getAnalysisProfileSettings(buildOpts, messageCount);
  const semanticModel = semanticEmbeddingModelId(buildOpts, messageCount);
  const sentimentModel = sentimentModelId(preset);
  const semanticCap = effectiveSemanticSampleCap(messageCount, buildOpts);
  const llmPlan = resolveLlmRunPlan({ preset, profile: profileMachine, messageCount });
  const semanticUsed = data.summary.usedSemanticKeywords === true;
  const sentimentUsed = data.summary.usedSentimentAnalysis === true;
  const llmUsed = data.summary.usedLlmAnalysis === true;

  return {
    preset,
    presetSource,
    profile: profileSettings.profile,
    privacy: cli.privacy,
    top: cli.top,
    since: cli.since,
    workerRequested: resolveWorkerRequested(cli.worker),
    workerUsed: false,
    semantic: {
      requested: resolveSemanticRequested(cli.semanticKeywords),
      used: semanticUsed,
      model: semanticModel,
      sampleCap: semanticCap,
      skippedReason: inferSemanticSkipReason(buildOpts, preset, semanticUsed),
    },
    sentiment: {
      requested: resolveSentimentRequested(cli.sentiment),
      used: sentimentUsed,
      model: sentimentModel,
      skippedReason: inferSentimentSkipReason(buildOpts, preset, sentimentUsed, messageCount),
    },
    encoderPlane: {
      sentiment: sentimentModel,
      embedding: semanticModel,
      toxicity: resolveToxicityModelId() || "lexicon",
    },
    llm: {
      enabled: llmPlan.enabled,
      size: llmPlan.size,
      reason: llmPlan.reason,
      used: llmUsed,
      modelId: qwenModelIdForPlan(llmPlan),
      skippedReason: inferLlmSkipReason(llmUsed, llmPlan, data.summary.llmSkippedReason),
    },
    topicModel: resolveTopicModel(data),
    embeddingTopics: profileSettings.useEmbeddingTopics,
    budgetMs: analysisBudgetMs(preset, messageCount, profileMachine),
    envOverrides: collectEnvOverrides(),
    invokedVia: parseKcaInvokerEnv(process.env.KCA_INVOKER),
    messageCount,
    machine: {
      freeMemGb: profileMachine.freeMemGb,
      availableMemGb: profileMachine.availableMemGb,
      totalMemGb: profileMachine.totalMemGb,
      gpu: profileMachine.gpu,
    },
  };
}

export function withWorkerUsed(
  config: AnalysisEffectiveConfig,
  workerUsed: boolean,
): AnalysisEffectiveConfig {
  return { ...config, workerUsed };
}

/** 집계 전 예상 preset (stderr 힌트) */
export function estimatePresetBeforeParse(
  cli: Pick<CliPipelineOptions, "preset" | "worker">,
  messageEstimate?: number,
): { preset: AnalysisPresetName; source: PresetSource } {
  const machine = probeMachineProfileSync();
  if (cli.preset) {
    return {
      preset: cli.preset,
      source: "cli",
    };
  }
  const env = process.env.KCA_PRESET?.trim().toLowerCase();
  if (env === "speed" || env === "balanced" || env === "quality" || env === "custom") {
    return { preset: env, source: "env" };
  }
  if (cli.worker === true || process.env.KCA_PROFILE === "fast") {
    return {
      preset: resolvePresetName({ worker: cli.worker }),
      source: "legacy-fast",
    };
  }
  const n = messageEstimate ?? 0;
  return {
    preset: autoPresetFromMachine(machine, n),
    source: resolvePresetSource(undefined, undefined, n, machine),
  };
}

export function formatEstimatedPresetHint(
  cli: Pick<CliPipelineOptions, "preset" | "worker">,
  messageEstimate?: number,
): string {
  const machine = probeMachineProfileSync();
  const { preset, source } = estimatePresetBeforeParse(cli, messageEstimate);
  const n =
    messageEstimate !== undefined
      ? ` · 메시지 ~${messageEstimate.toLocaleString("ko-KR")}건`
      : "";
  const ram =
    Math.abs(machine.availableMemGb - machine.freeMemGb) < 0.3
      ? `가용 RAM ${machine.availableMemGb}GB`
      : `가용 RAM ${machine.availableMemGb}GB (free ${machine.freeMemGb}GB)`;
  const lowFree =
    machine.freeMemGb < 2
      ? " · RAM 여유 낮음 — LLM 실패 시 KCA_LLM=0 또는 --local 권장"
      : "";
  return `[kca] 예상 preset: ${preset} (${presetSourceLabel(source)} · ${ram}${n})${lowFree}`;
}

function formatRequested(req: boolean | "auto"): string {
  if (req === "auto") return "auto";
  return req ? "on" : "off";
}

export function formatConfigSummaryKo(config: AnalysisEffectiveConfig): string {
  const lines: string[] = [
    "=== kca 분석 설정 ===",
    `preset: ${config.preset} (${presetSourceLabel(config.presetSource)})`,
    `프로필: ${config.profile} · 프라이버시: ${config.privacy} · 상위 목록: ${config.top}`,
    `메시지: ${config.messageCount.toLocaleString("ko-KR")}건 · ${formatMemoryLine(config.machine).replace(/^RAM: /, "")} · GPU ${config.machine.gpu}`,
    `Worker: 요청 ${formatRequested(config.workerRequested)} · 실제 ${config.workerUsed ? "사용" : "미사용"}`,
  ];
  if (config.since) lines.push(`기간 필터: ${config.since} 이후`);
  const sem = config.semantic;
  lines.push(
    `시맨틱: 요청 ${formatRequested(sem.requested)} · 실제 ${sem.used ? "사용" : "미사용"} · 모델 ${sem.model}${sem.sampleCap ? ` · 상한 ${sem.sampleCap}` : ""}`,
  );
  if (!sem.used && sem.skippedReason) lines.push(`  ↳ 미사용 사유: ${sem.skippedReason}`);
  const sent = config.sentiment;
  lines.push(
    `감정: 요청 ${formatRequested(sent.requested)} · 실제 ${sent.used ? "사용" : "미사용"} · 모델 ${sent.model}`,
  );
  if (!sent.used && sent.skippedReason) lines.push(`  ↳ 미사용 사유: ${sent.skippedReason}`);
  const llm = config.llm;
  const llmLabel =
    llm.enabled && llm.size ? qwen35DisplayLabel(llm.size) : "off";
  lines.push(
    `LLM: ${llmLabel} (${llm.reason}) · 실제 ${llm.used ? "사용" : "미사용"}${llm.modelId ? ` · ${llm.modelId}` : ""}`,
  );
  if (!llm.used && llm.skippedReason) lines.push(`  ↳ 미사용 사유: ${llm.skippedReason}`);
  lines.push(
    `주제: ${config.topicModel} · 임베딩 주제 레인: ${config.embeddingTopics ? "on" : "off"} · 분석 예산 ~${Math.round(config.budgetMs / 1000)}s`,
  );
  if (config.invokedVia) {
    lines.push(`실행 경로: ${config.invokedVia.name} ${config.invokedVia.version} → kca`);
  }
  if (config.envOverrides.length > 0) {
    lines.push(`환경 변수: ${config.envOverrides.join(", ")}`);
  }
  return lines.join("\n");
}

export function configToJson(config: AnalysisEffectiveConfig): string {
  return JSON.stringify(config, null, 2);
}

export function toProvenanceOptions(
  config: AnalysisEffectiveConfig,
  data: ReportData,
  extras: {
    kiwiAvailable: boolean;
    buildTiming?: BuildReportProvenanceOptions["buildTiming"];
    htmlBytes?: number;
  },
): BuildReportProvenanceOptions {
  return {
    privacy: config.privacy,
    top: config.top,
    since: config.since,
    workerRequested: config.workerRequested,
    workerUsed: config.workerUsed,
    semanticRequested: config.semantic.requested,
    sentimentRequested: config.sentiment.requested,
    kiwiAvailable: extras.kiwiAvailable,
    preset: config.preset,
    presetSource: config.presetSource,
    semanticModel: config.semantic.model,
    semanticCap: config.semantic.sampleCap,
    semanticSkippedReason:
      !config.semantic.used && config.semantic.skippedReason
        ? config.semantic.skippedReason
        : undefined,
    sentimentModel: config.sentiment.model,
    sentimentSkippedReason:
      !config.sentiment.used && config.sentiment.skippedReason
        ? config.sentiment.skippedReason
        : undefined,
    llmTier: llmProvenanceLabel({
      enabled: config.llm.enabled,
      size: config.llm.size,
      reason: config.llm.reason,
    }),
    llmUsed: config.llm.used,
    llmSkippedReason:
      !config.llm.used && config.llm.skippedReason ? config.llm.skippedReason : undefined,
    llmModelId: config.llm.modelId,
    gpu: config.machine.gpu,
    budgetMs: config.budgetMs,
    envOverrides: config.envOverrides.length > 0 ? config.envOverrides : undefined,
    embeddingTopics: config.embeddingTopics,
    buildTiming: extras.buildTiming,
    htmlBytes: extras.htmlBytes,
  };
}
