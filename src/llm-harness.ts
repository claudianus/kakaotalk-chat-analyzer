import { probeMachineProfileSync } from "./analysis-capability.js";
import type { AnalysisBudgetTracker } from "./analysis-budget.js";
import { resolveLlmGpuForInfer } from "./llm-gpu-policy.js";
import type { LlmRunPlan } from "./llm-policy.js";
import { canRetryLlmRam, minFreeGbForLlmRetry } from "./llm-policy.js";
import { effectiveLlmHeadroomGb } from "./llm-resolve.js";
import { qwen35Entry, qwen35DisplayLabel, type Qwen35Size } from "./llm-qwen35.js";
import type { LlamaGpuMode } from "./llm-llama-core.js";
import type { LlmHarnessAttemptRecord, LlmHarnessQuality, LlmInsights, ReportData } from "./types.js";
import {
  buildEnrichmentFromParsed,
  llmRetryBudgetSkipReason,
  parseCompletionRaw,
  runLlmCompletion,
  schemaFailureQuality,
  type LlmEnrichmentResult,
  type LlmSkipReasonCode,
} from "./llm-summarize.js";
import { isLlmMockEnabled, resetLlmMockCallIndex } from "./llm-mock.js";
import {
  buildHarnessRepairFeedback,
  type HarnessInferenceCode,
  type HarnessRepairKind,
} from "./llm-harness-feedback.js";
import { buildRuleBasedLlmFallback } from "./llm-rule-fallback.js";

export interface LlmHarnessAttemptSpec {
  label: string;
  compact: boolean;
  size: Qwen35Size;
  gpu?: LlamaGpuMode;
}

export function buildHarnessAttemptLadder(plan: LlmRunPlan): LlmHarnessAttemptSpec[] {
  const size = plan.size ?? "0.8B";
  const profile = probeMachineProfileSync();
  const primaryGpu = resolveLlmGpuForInfer(profile, size);
  const attempts: LlmHarnessAttemptSpec[] = [
    { label: "primary", compact: false, size, gpu: primaryGpu },
    { label: "compact-repair", compact: true, size, gpu: primaryGpu },
    { label: "cpu-compact", compact: true, size, gpu: "none" },
  ];
  if (size !== "0.8B") {
    attempts.push({
      label: "downgrade-0.8B",
      compact: true,
      size: "0.8B",
      gpu: "none",
    });
  }
  return attempts;
}

function deckFieldCount(ins: LlmInsights): number {
  let n = 0;
  if (ins.insightBullets?.length) n += ins.insightBullets.length;
  if (ins.shopSearchSummary) n += 1;
  if (ins.dyadInsight) n += 1;
  if (ins.topicProposals?.length) n += ins.topicProposals.length;
  if (ins.roomArchetype) n += 1;
  if (ins.moments?.length) n += ins.moments.length;
  if (ins.relationshipBeats?.length) n += ins.relationshipBeats.length;
  if (ins.episodeCards?.length) n += ins.episodeCards.length;
  if (ins.eraLabels?.length) n += ins.eraLabels.length;
  if (ins.insideJokes?.length) n += ins.insideJokes.length;
  if (ins.characterCards?.length) n += ins.characterCards.length;
  if (ins.dayMicroStories?.length) n += ins.dayMicroStories.length;
  if (ins.shareLine) n += 1;
  if (ins.hashtags?.length) n += ins.hashtags.length;
  if (ins.counterfactuals?.length) n += ins.counterfactuals.length;
  return n;
}

/** 하네스 성공 — LLM 검증 통과 또는 규칙 fallback deck */
export function hasHarnessDeckContent(result: LlmEnrichmentResult): boolean {
  if ((result.llmInsights && deckFieldCount(result.llmInsights) > 0) || false) return true;
  const paras = result.narrative?.paragraphs ?? [];
  return paras.some((p) => p.includes("**"));
}

export function isHarnessSuccess(result: LlmEnrichmentResult): boolean {
  const accepted = result.llmQuality?.acceptedClaims ?? 0;
  if (accepted > 0) return true;
  if (result.llmQuality?.fallbackUsed && hasHarnessDeckContent(result)) return true;
  return hasHarnessDeckContent(result);
}

function attachHarnessAttempts(
  result: LlmEnrichmentResult,
  attempts: LlmHarnessAttemptRecord[],
  repairAttempts: number,
): LlmEnrichmentResult {
  const base = result.llmQuality ?? schemaFailureQuality(repairAttempts);
  const llmQuality: LlmHarnessQuality = {
    ...base,
    repairAttempts,
    attempts,
  };
  return { ...result, llmQuality };
}

function recordAttempt(
  attempts: LlmHarnessAttemptRecord[],
  spec: LlmHarnessAttemptSpec,
  args: {
    ok: boolean;
    code?: LlmSkipReasonCode | "validation_fail" | "parse_fail" | "budget_skip" | "ram_skip";
    accepted?: number;
    dropped?: number;
    elapsedMs?: number;
    repairFeedback?: string;
  },
): void {
  const profile = probeMachineProfileSync();
  attempts.push({
    label: spec.label,
    ok: args.ok,
    code: args.code,
    accepted: args.accepted,
    dropped: args.dropped,
    elapsedMs: args.elapsedMs,
    freeRamGb: Math.round(profile.freeMemGb * 10) / 10,
    repairFeedback: args.repairFeedback,
  });
}

function canRunHarnessRetry(
  index: number,
  size: Qwen35Size,
  budget?: AnalysisBudgetTracker,
  priorAttempts?: LlmHarnessAttemptRecord[],
): string | undefined {
  if (index === 0) return undefined;
  const profile = probeMachineProfileSync();
  const hadInferenceFail = priorAttempts?.some(
    (a) => !a.ok && (a.code === "inference_error" || a.code === "timeout" || a.code === "gguf_missing"),
  );
  if (hadInferenceFail && size === "0.8B") {
    const headroom = effectiveLlmHeadroomGb(profile);
    const need = qwen35Entry("0.8B").minHeadroomGb;
    if (headroom >= need) return llmRetryBudgetSkipReason(budget);
    if (headroom >= need - 1) {
      process.stderr.write(
        `[kca] LLM 하네스: 추론 실패 후 0.8B CPU 시도 (headroom ${headroom}GB)\n`,
      );
      return llmRetryBudgetSkipReason(budget);
    }
  }
  if (isLlmMockEnabled()) {
    const floor = minFreeGbForLlmRetry();
    if (profile.freeMemGb < floor) {
      return `free ${profile.freeMemGb}GB`;
    }
  } else if (!canRetryLlmRam(profile, size)) {
    return `free ${profile.freeMemGb}GB`;
  }
  return llmRetryBudgetSkipReason(budget);
}

/** 통합 LLM 하네스 — 추론·파싱·검증·재시도를 단일 루프로 처리 */
export async function runLlmHarness(
  data: ReportData,
  plan: LlmRunPlan,
  budget?: AnalysisBudgetTracker,
): Promise<LlmEnrichmentResult> {
  if (!plan.enabled || !plan.size) {
    return { used: false, plan, skipReason: plan.reason };
  }

  if (isLlmMockEnabled()) resetLlmMockCallIndex();

  const ladder = buildHarnessAttemptLadder(plan);
  const attempts: LlmHarnessAttemptRecord[] = [];
  let lastFailure: LlmEnrichmentResult | undefined;
  let repairAttempts = 0;
  let nextRepairFeedback: string | undefined;

  for (let i = 0; i < ladder.length; i += 1) {
    const spec = ladder[i]!;
    const repairFeedback = i > 0 ? nextRepairFeedback : undefined;
    const retryBlock = canRunHarnessRetry(i, spec.size, budget, attempts);
    if (retryBlock) {
      const isBudget = retryBlock.includes("예산");
      recordAttempt(attempts, spec, {
        ok: false,
        code: isBudget ? "budget_skip" : "ram_skip",
      });
      process.stderr.write(`[kca] LLM 하네스 ${spec.label} 건너뜀 (${retryBlock})\n`);
      continue;
    }

    if (i > 0) {
      repairAttempts += 1;
      process.stderr.write(
        `[kca] LLM 하네스 재시도 (${spec.label}, ${qwen35DisplayLabel(spec.size)}, ${spec.gpu ?? "auto"})\n`,
      );
    }

    const completion = await runLlmCompletion(data, plan, {
      compact: spec.compact,
      sizeOverride: spec.size,
      gpuOverride: spec.gpu,
      harnessSingleShot: true,
      repairFeedback,
    });

    const setRepairFeedback = (
      kind: HarnessRepairKind,
      extra: Omit<Parameters<typeof buildHarnessRepairFeedback>[0], "kind" | "data">,
    ) => {
      nextRepairFeedback = buildHarnessRepairFeedback({ kind, data, ...extra });
    };

    if (!completion.ok) {
      recordAttempt(attempts, spec, {
        ok: false,
        code: completion.code,
        elapsedMs: completion.elapsedMs,
        repairFeedback,
      });
      setRepairFeedback("inference", {
        inferenceCode: completion.code as HarnessInferenceCode,
        skipReason: completion.skipReason,
      });
      lastFailure = { used: false, plan, skipReason: completion.skipReason };
      continue;
    }

    const parsed = parseCompletionRaw(completion.raw);
    if (!parsed) {
      recordAttempt(attempts, spec, {
        ok: false,
        code: "parse_fail",
        elapsedMs: completion.elapsedMs,
        repairFeedback,
      });
      setRepairFeedback("parse_fail", { raw: completion.raw });
      lastFailure = {
        used: false,
        plan,
        skipReason: `JSON 파싱 실패 (${qwen35DisplayLabel(completion.size)}, ${completion.elapsedMs}ms)`,
        llmQuality: schemaFailureQuality(repairAttempts),
      };
      continue;
    }

    const built = buildEnrichmentFromParsed(data, parsed, plan, repairAttempts);
    const accepted = built.llmQuality?.acceptedClaims ?? 0;
    const dropped = built.llmQuality?.droppedClaims ?? 0;

    if (isHarnessSuccess(built)) {
      recordAttempt(attempts, spec, {
        ok: true,
        accepted,
        dropped,
        elapsedMs: completion.elapsedMs,
        repairFeedback,
      });
      if (i > 0) {
        process.stderr.write(
          `[kca] LLM 하네스 성공 (${spec.label}, ${qwen35DisplayLabel(completion.size)}, ${completion.elapsedMs}ms)\n`,
        );
      }
      return attachHarnessAttempts({ ...built, used: true }, attempts, repairAttempts);
    }

    recordAttempt(attempts, spec, {
      ok: false,
      code: "validation_fail",
      accepted,
      dropped,
      elapsedMs: completion.elapsedMs,
      repairFeedback,
    });
    setRepairFeedback("validation_fail", { llmQuality: built.llmQuality });
    lastFailure = {
      used: false,
      plan,
      skipReason: `LLM 검증 실패 (${qwen35DisplayLabel(completion.size)}, accepted ${accepted})`,
      llmQuality: built.llmQuality,
    };
    process.stderr.write(
      `[kca] LLM 검증 실패 (${spec.label}, accepted ${accepted}, dropped ${dropped}) — 다음 attempt\n`,
    );
  }

  if (lastFailure) {
    const ruleFallback = buildRuleBasedLlmFallback(data, plan, {
      repairAttempts,
      reason: lastFailure.skipReason,
    });
    if (isHarnessSuccess(ruleFallback)) {
      process.stderr.write("[kca] LLM 하네스 실패 — 규칙 기반 fallback deck 적용\n");
      recordAttempt(attempts, { label: "rule-fallback", compact: true, size: plan.size ?? "0.8B" }, {
        ok: true,
        accepted: ruleFallback.llmQuality?.acceptedClaims,
        code: undefined,
      });
      return attachHarnessAttempts({ ...ruleFallback, used: true }, attempts, repairAttempts);
    }
    return attachHarnessAttempts(lastFailure, attempts, repairAttempts);
  }
  return {
    used: false,
    plan,
    skipReason: plan.reason || "LLM 하네스 실패",
    llmQuality: attachHarnessAttempts(
      { used: false, plan },
      attempts,
      repairAttempts,
    ).llmQuality,
  };
}
