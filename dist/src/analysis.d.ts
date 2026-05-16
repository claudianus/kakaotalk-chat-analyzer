export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { type BuildReportOptions } from "./analyze-pool.js";
import type { ParseResult, ReportData } from "./types.js";
export type { BuildReportOptions };
/** Kiwi 등 리포트 엔진 준비(스트리밍 분석 전 1회 호출) */
export declare function prepareReportEngine(): Promise<void>;
export declare function buildReportData(result: ParseResult, options?: BuildReportOptions): ReportData;
export declare function buildReportDataAsync(result: ParseResult, options?: BuildReportOptions): Promise<ReportData>;
export declare function buildReportFromExportSync(filePath: string, options?: BuildReportOptions): Promise<ReportData>;
export declare function buildReportFromExport(filePath: string, options?: BuildReportOptions): Promise<ReportData>;
/** CLI provenance용 — buildReportFromExport와 동일 조건 */
export declare function reportUsedAnalyzeWorker(filePath: string, options?: BuildReportOptions): Promise<boolean>;
