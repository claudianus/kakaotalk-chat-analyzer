import { stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { assembleLlmUserPrompt, buildLlmSystemPrompt } from "./llm-input.js";
import { ggufPathForSize } from "./llm-cache.js";
import {
  llmInferTimeoutMs,
  llmLoadTimeoutMs,
  resolveLlmRunPlan,
  type LlmRunPlan,
} from "./llm-policy.js";
import { ensureLlmGgufReady } from "./llm-ensure.js";
import {
  downgradeQwen35Size,
  qwen35DisplayLabel,
  type Qwen35Size,
} from "./llm-qwen35.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import type { AnalysisBudgetTracker } from "./analysis-budget.js";
import { extractLlmJsonObject, parseLlmJsonResponse, type LlmJsonShape } from "./llm-json.js";
import { mergeTopicProposals, type LlmTopicProposal } from "./topic-merge.js";
import {
  isLlmGarbageText,
  mergeLlmValidationAudits,
  sanitizeLlmDeckWithAudit,
  sanitizeLlmParagraphsWithAudit,
  textHasLlmEvidence,
} from "./llm-deck-validate.js";
import { buildKcaLlmJsonSchemaTier, resolveLlmSchemaTier } from "./llm-schema.js";
import type { LlmHarnessQuality, LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";
import { isLlmMockEnabled, runLlmMockCompletion } from "./llm-mock.js";
import { resolveLlmGpuForInfer } from "./llm-gpu-policy.js";
import { runLlamaPrompt, LlmInferProcessError } from "./llm-runtime.js";
import { resolveLlmMaxTokens, resolveLlmSamplingForStructured, type LlamaGpuMode } from "./llm-llama-core.js";

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
  llmQuality?: LlmHarnessQuality;
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
  systemPrompt: string,
  userPrompt: string,
  plan: LlmRunPlan,
  size: Qwen35Size,
  timeoutMs: number,
  sampling: { temperature: number; topP: number },
): Promise<string> {
  const host = process.env.KCA_OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
  const model = process.env.KCA_OLLAMA_MODEL?.trim() || plan.ollamaModel;
  if (!model) throw new Error("Ollama model 미설정");
  const body = {
    model,
    system: systemPrompt,
    prompt: userPrompt,
    stream: false,
    format: "json",
    options: { num_predict: resolveLlmMaxTokens(), temperature: sampling.temperature, top_p: sampling.topP },
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

interface LlamaInferAttempt {
  size: Qwen35Size;
  gpu: "none" | "metal" | "auto";
  label: string;
}

function buildLlamaInferAttempts(size: Qwen35Size): LlamaInferAttempt[] {
  const profile = probeMachineProfileSync();
  const primaryGpu = resolveLlmGpuForInfer(profile, size);
  const attempts: LlamaInferAttempt[] = [{ size, gpu: primaryGpu, label: "primary" }];
  if (primaryGpu !== "none") {
    attempts.push({ size, gpu: "none", label: "cpu-fallback" });
  }
  let next = downgradeQwen35Size(size);
  while (next) {
    attempts.push({ size: next, gpu: "none", label: `downgrade-${next}` });
    next = downgradeQwen35Size(next);
  }
  return attempts;
}

async function runNodeLlamaOnce(
  data: ReportData,
  size: Qwen35Size,
  plan: LlmRunPlan,
  gpu: LlamaInferAttempt["gpu"],
  llmOpts?: Pick<LlmCompletionOpts, "compact" | "repairFeedback" | "temperature">,
): Promise<string> {
  const ready = await ensureLlmGgufReady(size);
  const modelPath = ggufPathForSize(size);
  if (!ready) {
    throw new Error(
      `Qwen3.5 GGUF 없음: ${modelPath} (kca llm pull 또는 네트워크 확인)`,
    );
  }
  await stat(modelPath);

  const repairAttempt = !!llmOpts?.repairFeedback?.trim();
  const schemaTier = resolveLlmSchemaTier({
    modelSize: size,
    compact: llmOpts?.compact ?? false,
    repairAttempt,
  });
  const systemPrompt = buildLlmSystemPrompt({ tier: schemaTier, size });
  const userPrompt = assembleLlmUserPrompt(data, {
    compact: llmOpts?.compact,
    repairFeedback: llmOpts?.repairFeedback,
    schemaTier,
  });
  const sampling = resolveLlmSamplingForStructured({
    size,
    repairAttempt,
    override: llmOpts?.temperature !== undefined ? { temperature: llmOpts.temperature } : undefined,
  });

  return runLlamaPrompt({
    modelPath,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: resolveLlmMaxTokens(),
    loadTimeoutMs: llmLoadTimeoutMs(size),
    inferTimeoutMs: llmInferTimeoutMs(size, plan),
    gpu,
    grammarJsonSchema: buildKcaLlmJsonSchemaTier(schemaTier),
    sampling,
  });
}

async function runNodeLlama(
  data: ReportData,
  size: Qwen35Size,
  plan: LlmRunPlan,
  singleShot?: { gpu: LlamaGpuMode; llmOpts?: Pick<LlmCompletionOpts, "compact" | "repairFeedback" | "temperature"> },
): Promise<string> {
  if (singleShot) {
    return runNodeLlamaOnce(data, size, plan, singleShot.gpu, singleShot.llmOpts);
  }
  const attempts = buildLlamaInferAttempts(size);
  let lastError = "LLM 추론 실패";

  for (let i = 0; i < attempts.length; i += 1) {
    const att = attempts[i]!;
    try {
      const text = await runNodeLlamaOnce(data, att.size, plan, att.gpu);
      if (att.label !== "primary") {
        const gpuNote = att.gpu === "none" ? "CPU" : att.gpu;
        process.stderr.write(
          `[kca] LLM 재시도 성공 (${qwen35DisplayLabel(att.size)}, ${gpuNote}, ${att.label})\n`,
        );
      }
      return text;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      lastError = msg;
      const isLast = i === attempts.length - 1;
      if (isLast) break;

      if (error instanceof LlmInferProcessError && error.kind === "segfault") {
        process.stderr.write(
          `[kca] LLM 네이티브 크래시 (${qwen35DisplayLabel(att.size)}) → ${attempts[i + 1]?.label ?? "skip"}\n`,
        );
      } else {
        process.stderr.write(
          `[kca] LLM 실패 (${qwen35DisplayLabel(att.size)}, ${att.label}): ${msg.slice(0, 120)} → 재시도\n`,
        );
      }
    }
  }

  throw new Error(lastError);
}

function classifyError(error: unknown): { code: LlmSkipReasonCode; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("GGUF 없음")) return { code: "gguf_missing", message: msg };
  if (msg.includes("timeout") || msg.includes("abort")) return { code: "timeout", message: msg };
  return { code: "inference_error", message: msg };
}

export interface LlmCompletionOpts {
  compact?: boolean;
  sizeOverride?: Qwen35Size;
  gpuOverride?: LlamaGpuMode;
  temperature?: number;
  /** 하네스가 attempt ladder를 담당 — 내부 GPU/downgrade ladder 생략 */
  harnessSingleShot?: boolean;
  /** 이전 attempt 실패 피드백 — repair 프롬프트에 포함 */
  repairFeedback?: string;
}

export async function runLlmCompletion(
  data: ReportData,
  plan: LlmRunPlan,
  opts?: LlmCompletionOpts,
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

  const repairAttempt = !!opts?.repairFeedback?.trim();
  const schemaTier = resolveLlmSchemaTier({
    modelSize: size,
    compact: opts?.compact ?? false,
    repairAttempt,
  });
  const systemPrompt = buildLlmSystemPrompt({ tier: schemaTier, size });
  const userPrompt = assembleLlmUserPrompt(data, {
    compact: opts?.compact,
    repairFeedback: opts?.repairFeedback,
    schemaTier,
  });
  const sampling = resolveLlmSamplingForStructured({
    size,
    repairAttempt,
    override: opts?.temperature !== undefined ? { temperature: opts.temperature } : undefined,
  });
  const inferMs = llmInferTimeoutMs(size, plan);
  const started = performance.now();

  try {
    let raw: string;
    if (isLlmMockEnabled()) {
      raw = await runLlmMockCompletion();
    } else if (process.env.KCA_LLM_BACKEND?.trim().toLowerCase() === "ollama") {
      raw = await runOllama(systemPrompt, userPrompt, plan, size, inferMs + llmLoadTimeoutMs(size), sampling);
    } else {
      const singleShot =
        opts?.harnessSingleShot && opts.gpuOverride
          ? {
              gpu: opts.gpuOverride,
              llmOpts: {
                compact: opts.compact,
                repairFeedback: opts.repairFeedback,
                temperature: opts.temperature,
              },
            }
          : opts?.harnessSingleShot
            ? {
                gpu: resolveLlmGpuForInfer(probeMachineProfileSync(), size),
                llmOpts: {
                  compact: opts.compact,
                  repairFeedback: opts.repairFeedback,
                  temperature: opts.temperature,
                },
              }
            : undefined;
      raw = await runNodeLlama(data, size, plan, singleShot);
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
    const title = row.title?.trim();
    if (t && title && !isLlmGarbageText(title) && textHasLlmEvidence(`${title} ${t.terms.join(" ")}`, data)) {
      t.title = title.slice(0, 48);
    }
  }
  return topics;
}

function mergeNarrative(
  data: ReportData,
  parsed: LlmJsonShape,
  base: RoomNarrative,
): { narrative: RoomNarrative; audit: ReturnType<typeof sanitizeLlmParagraphsWithAudit>["audit"] } {
  const { paragraphs: llmParas, audit } = sanitizeLlmParagraphsWithAudit(parsed.paragraphs, data);
  if (llmParas.length === 0) return { narrative: base, audit };
  const merged = [...llmParas, ...base.paragraphs.slice(0, 2)];
  return {
    narrative: {
      ogSummary: base.ogSummary,
      paragraphs: merged.slice(0, 5),
    },
    audit,
  };
}

function mergeLlmInsights(
  data: ReportData,
  parsed: LlmJsonShape,
  proposals?: LlmTopicProposal[],
): { llmInsights: LlmInsights | undefined; audit: ReturnType<typeof sanitizeLlmDeckWithAudit>["audit"] } {
  const insightBullets = (parsed.insightBullets ?? [])
    .filter((s) => s.trim().length > 4 && !isLlmGarbageText(s) && textHasLlmEvidence(s, data))
    .slice(0, 5);
  const rawShop = parsed.shopSearchSummary?.trim().slice(0, 200);
  const shopSearchSummary = rawShop && !isLlmGarbageText(rawShop) && textHasLlmEvidence(rawShop, data) ? rawShop : undefined;
  const rawDyad = parsed.dyadInsight?.trim().slice(0, 200);
  const dyadInsight = rawDyad && !isLlmGarbageText(rawDyad) && textHasLlmEvidence(rawDyad, data) ? rawDyad : undefined;
  const topicProposals = (proposals ?? [])
    .filter((p) => p.title?.trim() && textHasLlmEvidence(`${p.title} ${(p.terms ?? p.keywordEvidence ?? []).join(" ")}`, data))
    .slice(0, 4)
    .map((p) => ({
      title: p.title.trim().slice(0, 48),
      terms: (p.terms ?? p.keywordEvidence ?? []).slice(0, 6),
    }));
  const { insights: deck, audit: deckAudit } = sanitizeLlmDeckWithAudit(parsed, data);
  const acceptedInline =
    insightBullets.length +
    (shopSearchSummary ? 1 : 0) +
    (dyadInsight ? 1 : 0) +
    topicProposals.length;
  const droppedInline =
    Math.max(0, (parsed.insightBullets ?? []).length - insightBullets.length) +
    (rawShop && !shopSearchSummary ? 1 : 0) +
    (rawDyad && !dyadInsight ? 1 : 0) +
    Math.max(0, (proposals ?? []).length - topicProposals.length);
  const audit = mergeLlmValidationAudits(deckAudit, {
    acceptedClaims: acceptedInline,
    droppedClaims: droppedInline,
    fallbackUsed: false,
    validationWarnings: droppedInline > 0 ? ["unsupported_inline_insight"] : [],
  });
  const merged: LlmInsights = {
    insightBullets,
    shopSearchSummary,
    dyadInsight,
    topicProposals,
    ...deck,
  };
  const hasContent =
    insightBullets.length ||
    shopSearchSummary ||
    dyadInsight ||
    topicProposals.length ||
    Object.keys(deck).length > 0;
  if (!hasContent) return { llmInsights: undefined, audit };
  return { llmInsights: merged, audit };
}

function toHarnessQuality(
  audit: ReturnType<typeof mergeLlmValidationAudits>,
  args?: { schemaValid?: boolean; repairAttempts?: number },
): LlmHarnessQuality {
  return {
    schemaValid: args?.schemaValid ?? true,
    acceptedClaims: audit.acceptedClaims,
    droppedClaims: audit.droppedClaims,
    repairAttempts: args?.repairAttempts ?? 0,
    fallbackUsed: audit.fallbackUsed,
    validationWarnings: audit.validationWarnings.slice(0, 12),
  };
}

export function buildEnrichmentFromParsed(
  data: ReportData,
  parsed: LlmJsonShape,
  plan: LlmRunPlan,
  repairAttempts = 0,
): LlmEnrichmentResult {
  let topics = mergeTopics(data, parsed);
  topics = mergeTopicProposals(
    topics,
    parsed.topicProposals as LlmTopicProposal[] | undefined,
    data.keywords,
    data.summary.totalMessages,
  );
  const narrativeResult = mergeNarrative(data, parsed, data.narrative);
  const insightsResult = mergeLlmInsights(
    data,
    parsed,
    parsed.topicProposals as LlmTopicProposal[] | undefined,
  );
  const audit = mergeLlmValidationAudits(narrativeResult.audit, insightsResult.audit);
  return {
    used: true,
    plan,
    topics,
    narrative: narrativeResult.narrative,
    llmInsights: insightsResult.llmInsights,
    llmQuality: toHarnessQuality(audit, { repairAttempts }),
  };
}

export function parseCompletionRaw(raw: string): LlmJsonShape | null {
  return parseLlmJsonResponse(raw, null);
}

export function schemaFailureQuality(repairAttempts = 0): LlmHarnessQuality {
  return {
    schemaValid: false,
    acceptedClaims: 0,
    droppedClaims: 0,
    repairAttempts,
    fallbackUsed: false,
    validationWarnings: ["schema_or_json_parse_failed"],
  };
}

export function llmRetryBudgetSkipReason(budget?: AnalysisBudgetTracker): string | undefined {
  if (!budget?.shouldSkip("llm_retry")) return undefined;
  const remainSec = Math.round(budget.remainingMs() / 1000);
  return `예산 부족 (LLM 재시도, 남은 ~${remainSec}s)`;
}

export interface LlmEnrichmentRunContext {
  budget?: AnalysisBudgetTracker;
  llmPlan?: LlmRunPlan;
}

/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export async function applyLlmEnrichment(
  data: ReportData,
  options?: BuildReportOptions,
  messageCount?: number,
  ctx?: LlmEnrichmentRunContext,
): Promise<LlmEnrichmentResult> {
  const preset = resolvePresetNameWithAuto(options, messageCount ?? data.summary.totalMessages);
  const profile = probeMachineProfileSync();
  const plan =
    ctx?.llmPlan ??
    resolveLlmRunPlan({ preset, profile, messageCount, postMl: true });
  const budget = ctx?.budget;
  if (!plan.enabled || !plan.size) {
    return { used: false, plan, skipReason: plan.reason };
  }

  try {
    const { runLlmHarness } = await import("./llm-harness.js");
    return await runLlmHarness(data, plan, budget);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kca] LLM 건너뜀 — ${msg}\n`);
    return { used: false, plan, skipReason: `LLM 오류: ${msg}` };
  }
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
