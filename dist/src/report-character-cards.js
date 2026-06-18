import { formatNumber } from "./report-util.js";
const TOP_CHARACTER_COUNT = 10;
function defaultTagline(p, rank) {
    if (rank === 0)
        return "이 방에서 가장 많이 말한 사람";
    if (p.nightMessages / Math.max(p.messages, 1) >= 0.3)
        return "밤늦게까지 채팅창을 지키는 타입";
    if (p.averageLength >= 35)
        return "길게 맥락을 설명하는 편";
    if (p.linkMessages >= 8)
        return "링크와 자료를 자주 던지는 편";
    if (p.attachmentMessages >= 8)
        return "사진·첨부로 분위기를 만드는 편";
    if (p.maxConsecutive >= 10)
        return "한 번 붙으면 길게 이어 말하는 편";
    return "꾸준히 대화에 참여하는 멤버";
}
/** 메시지 상위 10명은 항상 포함 — LLM 카드가 있으면 tagline/statHook 보강 */
export function resolveCharacterCards(data) {
    const top = data.participants.slice(0, TOP_CHARACTER_COUNT);
    if (top.length === 0)
        return [];
    const llmByAlias = new Map((data.llmInsights?.characterCards ?? []).map((c) => [c.alias, c]));
    return top.map((p, rank) => {
        const llm = llmByAlias.get(p.alias);
        const statHook = `${formatNumber(p.messages)}건 · ${p.sharePercent}% · 평균 ${p.averageLength}자`;
        if (llm) {
            return {
                alias: p.alias,
                tagline: llm.tagline?.trim() || defaultTagline(p, rank),
                statHook: llm.statHook?.trim() || statHook,
            };
        }
        return {
            alias: p.alias,
            tagline: defaultTagline(p, rank),
            statHook,
        };
    });
}
//# sourceMappingURL=report-character-cards.js.map