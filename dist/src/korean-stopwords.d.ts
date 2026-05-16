/** 채팅·구어 불용어·접속사·대명사·짧은 응답 */
export declare const KOREAN_CHAT_STOPWORDS: Set<string>;
/** 단독 토큰으로만 걸러지는 1~2글자 채팅 반응·자모 */
export declare const REACTION_ONLY_RE: RegExp;
/** 조사 분할·n-gram에서 떨어진 어미 조각 (단독 키워드 금지) */
export declare const MORPHOLOGICAL_FRAGMENTS: Set<string>;
/** 동사 활용 꼬리만 남은 3~4글자 (하는X) */
export declare const VERB_FRAGMENT_RE: RegExp;
/** 2글자인데 어미/조사 꼬리만 남은 형태 */
export declare const FRAGMENT_TAIL_RE: RegExp;
