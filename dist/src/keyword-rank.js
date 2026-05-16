/** 메시지 수에 따른 최소 문서 빈도 */
export function adaptiveMinCount(messageCount) {
    if (messageCount < 200)
        return 2;
    if (messageCount < 2_000)
        return 3;
    if (messageCount < 20_000)
        return 4;
    return 5;
}
//# sourceMappingURL=keyword-rank.js.map