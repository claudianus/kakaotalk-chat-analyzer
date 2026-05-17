import type { ReportData } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
/** finalize 이후 리포트에 LLM 보강 반영 */
export declare function enrichReportWithLlm(report: ReportData, options?: BuildReportOptions): Promise<ReportData>;
