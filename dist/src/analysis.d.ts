export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { type BuildReportOptions } from "./analyze-pool.js";
import type { ParseResult, ReportData } from "./types.js";
export type { BuildReportOptions };
export declare function buildReportData(result: ParseResult, options?: BuildReportOptions): ReportData;
export declare function buildReportFromExportSync(filePath: string, options?: BuildReportOptions): Promise<ReportData>;
export declare function buildReportFromExport(filePath: string, options?: BuildReportOptions): Promise<ReportData>;
