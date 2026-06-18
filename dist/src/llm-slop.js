/** LLM 출력에서 흔한 AI 슬롭·템플릿 문구 — 검증·하네스 repair 공용 */
const AI_SLOP_PATTERNS = [
    /(?:AI 분석 결과|압도적|압도적인|흥미로운|흥미롭게도|다채로운|놀라운|놀랍게도)/i,
    /(?:풍부한 대화|의미 있는 대화|의미있는 대화|다양한 이야기를 나누는|시사합니다|특별한 공간입니다|활발한 소통의 장)/i,
    /(?:역동적인|소통의 장|대화의 흐름|활발한 교류|깊이 있는 대화|따뜻한 공간|의미 있는 순간)/i,
    /(?:delve|robust|seamless|pivotal|foster|tapestry|vibrant|crucial|underscore|showcase|elevate)/i,
    /(?:navigate|realm|interplay|multifaceted|landscape|leverage|utilize|embark|testament)/i,
    /(?:moreover|furthermore|in conclusion|it'?s worth noting|at its core|serves as|stands as)/i,
];
export const AI_SLOP_EXAMPLE_PHRASES = [
    "흥미롭게도",
    "다채로운",
    "활발한 소통의 장",
    "의미 있는 대화",
    "delve",
    "tapestry",
    "it's worth noting",
];
export function isAiSlopText(value) {
    const v = value.trim();
    if (v.length < 4)
        return false;
    return AI_SLOP_PATTERNS.some((re) => re.test(v));
}
//# sourceMappingURL=llm-slop.js.map