/** 카톡 보내기·한국어 대화 감지·한국어 우선 분석 정책 */
export declare function countScriptChars(text: string): {
    hangul: number;
    latin: number;
};
/** 한국어 비중이 높은 대화방(카톡 기본) */
export declare function isPrimarilyKoreanText(corpus: string, messageCount: number): boolean;
export declare function isPrimarilyKoreanMessages(messages: string[]): boolean;
