/** 메시지 수에 따른 최소 문서 빈도 */
export function adaptiveMinCount(messageCount, koreanPrimary = true) {
    let min;
    if (messageCount < 200)
        min = 2;
    else if (messageCount < 2_000)
        min = 3;
    else if (messageCount < 100_000)
        min = 4;
    else
        min = 5;
    if (koreanPrimary && messageCount < 8_000 && min > 2)
        return min - 1;
    return min;
}
//# sourceMappingURL=keyword-rank.js.map