import type { ParsedDateParts } from "./types.js";
export declare function parseKakaoDate(raw: string): ParsedDateParts | null;
export declare function formatDateTime(parts: ParsedDateParts): string;
export declare function formatDate(parts: ParsedDateParts): string;
export declare function weekdayIndex(parts: ParsedDateParts): number;
/** UTC 기준 타임스탬프(ms). 연속 일수·응답 간격 계산에 사용합니다. */
export declare function partsToUtcMs(parts: ParsedDateParts): number;
