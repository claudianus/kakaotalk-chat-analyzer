import { AMBIGUOUS_UNIGRAMS, isDiscourseTerm } from "./discourse-lexicon.js";
/** 키워드 랭킹에서 제외할 저품질·잡음 토큰 */
const NOISE_LATIN = new Set([
    "install",
    "usage",
    "code",
    "kilo",
    "ent",
    "md",
    "ts",
    "api",
    "url",
    "http",
    "www",
    "com",
    "org",
]);
/** 단독으로 의미가 약한 조각어 */
const HANGUL_FRAGMENTS = new Set([
    "괜찮",
    "그러",
    "그래",
    "거든",
    "인데",
    "하는",
    "해도",
    "안되",
    "있어",
    "없어",
    "되면",
    "하면",
    "해서",
    "이런",
    "저런",
    "그런",
    "뭔가",
    "약간",
    "완전",
    "되게",
    "엄청",
    "일단",
    "근데",
    "그냥",
    "아니",
    "맞아",
    "오케이",
]);
export function isNoiseKeyword(label) {
    const w = label.trim();
    if (w.length < 2)
        return true;
    if (/^\d{1,4}$/.test(w))
        return true;
    if (/^[a-z]{1,3}$/i.test(w) && w.length <= 3)
        return true;
    if (/^[a-z]+$/i.test(w) && w.length <= 8 && NOISE_LATIN.has(w.toLowerCase()))
        return true;
    if (/[_/]/.test(w))
        return true;
    if (/^google_|_vignette$/i.test(w))
        return true;
    if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(w))
        return true;
    if (HANGUL_FRAGMENTS.has(w))
        return true;
    if (isDiscourseTerm(w))
        return true;
    if (!w.includes(" ") && AMBIGUOUS_UNIGRAMS.has(w))
        return true;
    if (w.length >= 8 && !/\s/.test(w) && !/^[A-Za-z]+$/.test(w))
        return true;
    if (w.includes(" ")) {
        const parts = w.split(" ");
        if (parts.every((p) => isDiscourseTerm(p) || HANGUL_FRAGMENTS.has(p)))
            return true;
    }
    return false;
}
//# sourceMappingURL=keyword-quality.js.map