/** 공백·접미사 휴리스틱만 (비교·KCA_NO_KIWI용) */
export declare function tokenizeHeuristicOnly(raw: string): string[];
/** 본문 키워드: 공백 어절 + (한글 있으면) Kiwi 형태소 병합 */
export declare function tokenizeForKeywords(raw: string): string[];
