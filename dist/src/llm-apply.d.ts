import type { ReportData } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { AnalysisBudgetTracker } from "./analysis-budget.js";
import type { LlmRunPlan } from "./llm-policy.js";
export interface LlmEnrichmentContext {
    budget?: AnalysisBudgetTracker;
    llmPlan?: LlmRunPlan;
}
/** finalize 이후 리포트에 LLM 보강 반영 */
export declare function enrichReportWithLlm(report: ReportData, options?: BuildReportOptions, ctx?: LlmEnrichmentContext): Promise<ReportData>;
