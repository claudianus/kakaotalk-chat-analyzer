/** 카톡 보내기·한국어 대화 감지·한국어 우선 분석 정책 */
const HANGUL_RE = /[가-힣]/g;
const LATIN_RE = /[A-Za-z]/g;
export function countScriptChars(text) {
    return {
        hangul: (text.match(HANGUL_RE) ?? []).length,
        latin: (text.match(LATIN_RE) ?? []).length,
    };
}
/** 한국어 비중이 높은 대화방(카톡 기본) */
export function isPrimarilyKoreanText(corpus, messageCount) {
    if (messageCount < 8)
        return true;
    const { hangul, latin } = countScriptChars(corpus);
    if (hangul < 24)
        return false;
    if (latin === 0)
        return true;
    return hangul >= latin * 0.85;
}
export function isPrimarilyKoreanMessages(messages) {
    const sample = messages.filter((m) => m.length >= 2).slice(0, 220);
    if (sample.length === 0)
        return true;
    return isPrimarilyKoreanText(sample.join("\n"), sample.length);
}
//# sourceMappingURL=korean-locale.js.map