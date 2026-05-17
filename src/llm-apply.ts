import type { ReportData } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { applyLlmEnrichment } from "./llm-summarize.js";

/** finalize 이후 리포트에 LLM 보강 반영 */
export async function enrichReportWithLlm(
  report: ReportData,
  options?: BuildReportOptions,
): Promise<ReportData> {
  const result = await applyLlmEnrichment(report, options, report.summary.totalMessages);
  if (!result.used) {
    return {
      ...report,
      summary: { ...report.summary, usedLlmAnalysis: false },
    };
  }
  return {
    ...report,
    topics: result.topics ?? report.topics,
    narrative: result.narrative ?? report.narrative,
    llmInsights: result.llmInsights ?? report.llmInsights,
    summary: { ...report.summary, usedLlmAnalysis: true },
  };
}
