import { KOREAN_CHAT_STOPWORDS } from "./korean-stopwords.js";
/** 채팅 담화·접속·예의·범용 서술어 — 키워드·주제맵·시맨틱 공통 */
export const DISCOURSE_LEXICON = new Set([
    "있어요",
    "있음",
    "있어서",
    "없어요",
    "그런거",
    "이런거",
    "저런거",
    "같은거",
    "그런",
    "이런",
    "이건",
    "그건",
    "이걸",
    "하네요",
    "되면",
    "하면",
    "해서",
    "쓰고",
    "쓰면",
    "계속",
    "갑자기",
    "일단",
    "근데",
    "그냥",
    "뭔가",
    "약간",
    "완전",
    "진짜",
    "아니",
    "아니고",
    "아니면",
    "맞아",
    "오케이",
    "이야기",
    "이해",
    "이유",
    "시간",
    "오늘",
    "내일",
    "어제",
    "지금",
    "다시",
    "정도",
    "생각",
    "사람",
    "우리",
    "거기",
    "여기",
    "요즘",
    "부탁",
    "환영",
    "한데",
    "감사합니다",
    "말씀",
    "필요",
    "처음",
    "직접",
    "그래도",
    "어떤",
    "누가",
    "기억",
    "고민",
]);
/** 단독 키워드로 쓰이면 모호한 짧은 토큰 */
export const AMBIGUOUS_UNIGRAMS = new Set(["프로"]);
const CHAT_ENDING_RE = /(?:습니다|해요|했어요|거든요|인데요|하네요|습니다|요|임|음|네|지|거|데|고|면|는|은|을|를)$/u;
const VERBISH_ENDING_RE = /(?:고|서|면|지|아|어|야)$/u;
export function discourseStem(term) {
    let w = term.trim();
    for (let i = 0; i < 2; i += 1) {
        const next = w.replace(CHAT_ENDING_RE, "");
        if (next === w || next.length < 2)
            break;
        w = next;
    }
    return w;
}
export function isDiscourseTerm(term) {
    const w = term.trim();
    if (!w)
        return true;
    if (DISCOURSE_LEXICON.has(w))
        return true;
    const stem = discourseStem(w);
    if (stem !== w && DISCOURSE_LEXICON.has(stem))
        return true;
    if (KOREAN_CHAT_STOPWORDS.has(w))
        return true;
    if (stem !== w && KOREAN_CHAT_STOPWORDS.has(stem))
        return true;
    if (w.length <= 3 && VERBISH_ENDING_RE.test(w) && !/^[A-Za-z]/.test(w))
        return true;
    return false;
}
export function discourseRatio(terms) {
    if (terms.length === 0)
        return 1;
    return terms.filter((t) => isDiscourseTerm(t)).length / terms.length;
}
export function mergeDiscourseIntoStopwords(base) {
    for (const w of DISCOURSE_LEXICON)
        base.add(w);
    return base;
}
//# sourceMappingURL=discourse-lexicon.js.map