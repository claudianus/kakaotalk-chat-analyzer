import type { ParseResult, PrivacyMode, ReportData } from "./types.js";
export declare function buildReportData(result: ParseResult, options?: {
    privacy?: PrivacyMode;
    top?: number;
}): ReportData;
export declare function safeInputName(filePath: string): string;
/** 참여자 실명 대신 앞·뒤 일부만 남기고 가운데는 마스킹합니다. */
export declare function maskPartialDisplayName(raw: string): string;
