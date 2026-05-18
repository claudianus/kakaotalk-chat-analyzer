import { stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { buildLlmPromptPayload, LLM_SYSTEM_PROMPT } from "./llm-input.js";
import { ggufPathForSize } from "./llm-cache.js";
import {
  llmInferTimeoutMs,
  llmLoadTimeoutMs,
  resolveLlmRunPlan,
  type LlmRunPlan,
} from "./llm-policy.js";
import { ensureLlmGgufReady } from "./llm-ensure.js";
import { qwen35DisplayLabel, qwen35Entry, type Qwen35Size } from "./llm-qwen35.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { extractLlmJsonObject, type LlmJsonShape } from "./llm-json.js";
import { mergeTopicProposals, type LlmTopicProposal } from "./topic-merge.js";
import type { LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";
import { runLlamaPrompt } from "./llm-runtime.js";

export type LlmSkipReasonCode =
  | "disabled"
  | "gguf_missing"
  | "timeout"
  | "json_parse"
  | "inference_error";

export interface LlmEnrichmentResult {
  used: boolean;
  plan: LlmRunPlan;
  narrative?: RoomNarrative;
  topics?: ReportTopic[];
  llmInsights?: LlmInsights;
  skipReason?: string;
}

interface LlmCompletionOk {
  ok: true;
  raw: string;
  size: Qwen35Size;
  elapsedMs: number;
}

interface LlmCompletionFail {
  ok: false;
  skipReason: string;
  code: LlmSkipReasonCode;
  size: Qwen35Size;
  elapsedMs: number;
}

type LlmCompletionResult = LlmCompletionOk | LlmCompletionFail;

function debugLlmRaw(raw: string, label: string): void {
  if (process.env.KCA_DEBUG_LLM !== "1") return;
  const tail = raw.slice(-500);
  process.stderr.write(`[kca] LLM debug (${label}, tail ${tail.length} chars):\n${tail}\n`);
}

async function runOllama(
  prompt: string,
  plan: LlmRunPlan,
  size: Qwen35Size,
  timeoutMs: number,
): Promise<string> {
  const host = process.env.KCA_OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
  const model = process.env.KCA_OLLAMA_MODEL?.trim() || plan.ollamaModel;
  if (!model) throw new Error("Ollama model 미설정");
  const body = {
    model,
    prompt: `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`,
    stream: false,
    options: { num_predict: 768 },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = (await res.json()) as { response?: string };
    return json.response ?? "";
  } finally {
    clearTimeout(timer);
  }
}

async function runNodeLlama(
  prompt: string,
  size: Qwen35Size,
  plan: LlmRunPlan,
): Promise<string> {
  const ready = await ensureLlmGgufReady(size);
  const modelPath = ggufPathForSize(size);
  if (!ready) {
    throw new Error(
      `Qwen3.5 GGUF 없음: ${modelPath} (kca llm pull 또는 네트워크 확인)`,
    );
  }
  await stat(modelPath);

  const fullPrompt = `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`;
  return runLlamaPrompt({
    modelPath,
    prompt: fullPrompt,
    maxTokens: 768,
    loadTimeoutMs: llmLoadTimeoutMs(size),
    inferTimeoutMs: llmInferTimeoutMs(size, plan),
  });
}

async function runMockLlm(): Promise<string> {
  return JSON.stringify({
    topicTitles: [{ i: 0, title: "모의 LLM 주제" }],
    topicProposals: [
      {
        title: "AI 코딩 도구",
        terms: ["클로드", "코덱스", "토큰"],
        keywordEvidence: ["클로드", "코덱스"],
      },
    ],
    paragraphs: [
      "**통계 기반** 서사 첫 문단입니다.",
      "두 번째 문단은 규칙 기반 서사를 보강합니다.",
    ],
    insightBullets: ["모의 인사이트: 상위 키워드가 개발·AI 도구에 집중됩니다."],
    shopSearchSummary: "샵검색 태그는 소수이며 환율·계산기 등 실용 주제가 보입니다.",
    dyadInsight: "상위 두 명이 대화 허브 역할을 합니다.",
  });
}

function classifyError(error: unknown): { code: LlmSkipReasonCode; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("GGUF 없음")) return { code: "gguf_missing", message: msg };
  if (msg.includes("timeout") || msg.includes("abort")) return { code: "timeout", message: msg };
  return { code: "inference_error", message: msg };
}

export async function runLlmCompletion(
  data: ReportData,
  plan: LlmRunPlan,
  opts?: { compact?: boolean; sizeOverride?: Qwen35Size },
): Promise<LlmCompletionResult> {
  if (!plan.enabled) {
    return {
      ok: false,
      skipReason: plan.reason,
      code: "disabled",
      size: opts?.sizeOverride ?? plan.size ?? "0.8B",
      elapsedMs: 0,
    };
  }
  const size = opts?.sizeOverride ?? plan.size;
  if (!size) {
    return {
      ok: false,
      skipReason: plan.reason,
      code: "disabled",
      size: "0.8B",
      elapsedMs: 0,
    };
  }

  const prompt = buildLlmPromptPayload(data, { compact: opts?.compact });
  const inferMs = llmInferTimeoutMs(size, plan);
  const started = performance.now();

  try {
    let raw: string;
    if (process.env.KCA_LLM_MOCK === "1") {
      raw = await runMockLlm();
    } else if (process.env.KCA_LLM_BACKEND?.trim().toLowerCase() === "ollama") {
      raw = await runOllama(prompt, plan, size, inferMs + llmLoadTimeoutMs(size));
    } else {
      raw = await runNodeLlama(prompt, size, plan);
    }
    const elapsedMs = Math.round(performance.now() - started);
    debugLlmRaw(raw, `${qwen35DisplayLabel(size)} ok ${elapsedMs}ms`);
    return { ok: true, raw, size, elapsedMs };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - started);
    const { code, message } = classifyError(error);
    const skipReason =
      code === "timeout"
        ? `추론 타임아웃 (${qwen35DisplayLabel(size)}, ${elapsedMs}ms, 상한 load ${llmLoadTimeoutMs(size)}ms + infer ${inferMs}ms)`
        : code === "gguf_missing"
          ? message
          : `추론 실패 (${qwen35DisplayLabel(size)}, ${elapsedMs}ms): ${message}`;
    process.stderr.write(`[kca] LLM 건너뜀 — ${skipReason}\n`);
    return { ok: false, skipReason, code, size, elapsedMs };
  }
}

function mergeTopics(data: ReportData, parsed: LlmJsonShape): ReportTopic[] {
  const topics = data.topics.map((t) => ({ ...t }));
  for (const row of parsed.topicTitles ?? []) {
    const t = topics[row.i];
    if (t && row.title?.trim()) {
      t.title = row.title.trim().slice(0, 48);
    }
  }
  return topics;
}

function mergeNarrative(data: ReportData, parsed: LlmJsonShape, base: RoomNarrative): RoomNarrative {
  const llmParas = (parsed.paragraphs ?? []).filter((p) => p.trim().length > 8).slice(0, 3);
  if (llmParas.length === 0) return base;
  const merged = [...llmParas, ...base.paragraphs.slice(0, 2)];
  return {
    ogSummary: base.ogSummary,
    paragraphs: merged.slice(0, 5),
  };
}

function mergeLlmInsights(
  parsed: LlmJsonShape,
  proposals?: LlmTopicProposal[],
): LlmInsights | undefined {
  const insightBullets = (parsed.insightBullets ?? []).filter((s) => s.trim().length > 4).slice(0, 5);
  const shopSearchSummary = parsed.shopSearchSummary?.trim().slice(0, 200);
  const dyadInsight = parsed.dyadInsight?.trim().slice(0, 200);
  const topicProposals = (proposals ?? [])
    .filter((p) => p.title?.trim())
    .slice(0, 4)
    .map((p) => ({
      title: p.title.trim().slice(0, 48),
      terms: (p.terms ?? p.keywordEvidence ?? []).slice(0, 6),
    }));
  if (!insightBullets.length && !shopSearchSummary && !dyadInsight && !topicProposals.length) {
    return undefined;
  }
  return { insightBullets, shopSearchSummary, dyadInsight, topicProposals };
}

function buildEnrichmentFromParsed(
  data: ReportData,
  parsed: LlmJsonShape,
  plan: LlmRunPlan,
): LlmEnrichmentResult {
  let topics = mergeTopics(data, parsed);
  topics = mergeTopicProposals(
    topics,
    parsed.topicProposals as LlmTopicProposal[] | undefined,
    data.keywords,
    data.summary.totalMessages,
  );
  const narrative = mergeNarrative(data, parsed, data.narrative);
  const llmInsights = mergeLlmInsights(parsed, parsed.topicProposals as LlmTopicProposal[] | undefined);
  return { used: true, plan, topics, narrative, llmInsights };
}

function shouldRetryAfterPrimaryFailure(primary: LlmCompletionFail): boolean {
  return primary.code === "timeout";
}

/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export async function applyLlmEnrichment(
  data: ReportData,
  options?: BuildReportOptions,
  messageCount?: number,
): Promise<LlmEnrichmentResult> {
  const preset = resolvePresetNameWithAuto(options, messageCount ?? data.summary.totalMessages);
  const profile = probeMachineProfileSync();
  const plan = resolveLlmRunPlan({ preset, profile, messageCount });
  if (!plan.enabled || !plan.size) {
    return { used: false, plan, skipReason: plan.reason };
  }

  const primary = await runLlmCompletion(data, plan);
  if (primary.ok) {
    const parsed = extractLlmJsonObject(primary.raw);
    if (parsed) return buildEnrichmentFromParsed(data, parsed, plan);
    process.stderr.write(
      `[kca] LLM JSON 파싱 실패 (${qwen35DisplayLabel(primary.size)}, ${primary.elapsedMs}ms) — 0.8B 축약 재시도\n`,
    );
    debugLlmRaw(primary.raw, "parse_fail primary");
  } else if (!shouldRetryAfterPrimaryFailure(primary)) {
    return { used: false, plan, skipReason: primary.skipReason };
  }

  if (plan.size === "0.8B" && primary.ok) {
    return {
      used: false,
      plan,
      skipReason: `JSON 파싱 실패 (${qwen35DisplayLabel("0.8B")}, ${primary.elapsedMs}ms)`,
    };
  }

  const retrySize: Qwen35Size = "0.8B";
  const retryPlan: LlmRunPlan = {
    ...plan,
    size: retrySize,
    reason: `${plan.reason} → 재시도 ${qwen35DisplayLabel(retrySize)} compact`,
    timeoutMs: qwen35Entry(retrySize).timeoutMs,
  };
  const retry = await runLlmCompletion(data, retryPlan, { compact: true, sizeOverride: retrySize });
  if (!retry.ok) {
    const skipReason =
      !primary.ok && primary.code === "timeout"
        ? `${primary.skipReason}; 재시도: ${retry.skipReason}`
        : retry.skipReason;
    return { used: false, plan, skipReason };
  }

  const parsedRetry = extractLlmJsonObject(retry.raw);
  if (!parsedRetry) {
    const skipReason = `JSON 파싱 실패 (${qwen35DisplayLabel(retrySize)}, ${retry.elapsedMs}ms)`;
    process.stderr.write(`[kca] LLM ${skipReason} — 규칙 기반 서사 유지\n`);
    debugLlmRaw(retry.raw, "parse_fail retry");
    return { used: false, plan, skipReason };
  }

  return buildEnrichmentFromParsed(data, parsedRetry, plan);
}

/** @deprecated use applyLlmEnrichment */
export async function summarizeTopicsWithLlm(
  preset: AnalysisPresetName,
  topics: string[],
  sampleLines: string[],
): Promise<null> {
  void preset;
  void topics;
  void sampleLines;
  return null;
}
