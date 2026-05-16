/** 키워드 랭킹에서 제외할 저품질·잡음 토큰 */
export function isNoiseKeyword(label) {
    const w = label.trim();
    if (w.length < 2)
        return true;
    if (/^\d{1,4}$/.test(w))
        return true;
    if (/^[a-z]{1,3}$/i.test(w) && w.length <= 3)
        return true;
    if (/[_/]/.test(w))
        return true;
    if (/^google_|_vignette$/i.test(w))
        return true;
    if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(w))
        return true;
    return false;
}
//# sourceMappingURL=keyword-quality.js.map