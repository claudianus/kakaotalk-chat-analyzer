export declare function escapeHtml(value: string): string;
export declare function formatNumber(value: number): string;
/** 카드·헤드라인용 축약 (만·억, k/M 미사용) */
export declare function formatCompactNumber(value: number): string;
/** 응답 간격(분)을 읽기 쉬운 한국어로 */
export declare function formatReplyGapMinutes(minutes: number | null): string;
export declare function renderHighlightLine(line: string): string;
