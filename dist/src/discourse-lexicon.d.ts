/** 채팅 담화·접속·예의·범용 서술어 — 키워드·주제맵·시맨틱 공통 */
export declare const DISCOURSE_LEXICON: Set<string>;
/** 단독 키워드로 쓰이면 모호한 짧은 토큰 */
export declare const AMBIGUOUS_UNIGRAMS: Set<string>;
export declare function discourseStem(term: string): string;
export declare function isDiscourseTerm(term: string): boolean;
export declare function discourseRatio(terms: readonly string[]): number;
export declare function mergeDiscourseIntoStopwords(base: Set<string>): Set<string>;
