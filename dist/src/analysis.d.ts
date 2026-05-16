export { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import type { ParseResult, PrivacyMode, ReportData } from "./types.js";
export declare function buildReportData(result: ParseResult, options?: {
    privacy?: PrivacyMode;
    top?: number;
}): ReportData;
export declare function buildReportFromExport(filePath: string, options?: {
    privacy?: PrivacyMode;
    top?: number;
}): Promise<ReportData>;
