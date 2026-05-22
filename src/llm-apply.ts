import type { ReportData } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { AnalysisBudgetTracker } from "./analysis-budget.js";
import type { LlmRunPlan } from "./llm-policy.js";
import { applyLlmEnrichment } from "./llm-summarize.js";
import { enhanceMemorableMomentsWithLlm } from "./memorable-moments.js";

export interface LlmEnrichmentContext {
  budget?: AnalysisBudgetTracker;
  llmPlan?: LlmRunPlan;
}

/** finalize 이후 리포트에 LLM 보강 반영 */
export async function enrichReportWithLlm(
  report: ReportData,
  options?: BuildReportOptions,
  ctx?: LlmEnrichmentContext,
): Promise<ReportData> {
  const result = await applyLlmEnrichment(
    report,
    options,
    report.summary.totalMessages,
    { budget: ctx?.budget, llmPlan: ctx?.llmPlan },
  );
  if (!result.used) {
    return {
      ...report,
      summary: {
        ...report.summary,
        usedLlmAnalysis: false,
        ...(result.skipReason ? { llmSkippedReason: result.skipReason } : {}),
      },
    };
  }

  // LLM 보강 적용
  const enhancedMoments = enhanceMemorableMomentsWithLlm(
    report.memorableMoments,
    result.llmInsights
  );

  return {
    ...report,
    topics: result.topics ?? report.topics,
    narrative: result.narrative ?? report.narrative,
    llmInsights: result.llmInsights ?? report.llmInsights,
    memorableMoments: enhancedMoments,
    summary: {
      ...report.summary,
      usedLlmAnalysis: true,
      llmSkippedReason: undefined,
    },
  };
}
