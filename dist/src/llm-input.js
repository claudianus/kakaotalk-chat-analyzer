/** LLM 입력 — 원문 메시지·PII 없이 통계·키워드·주제만 */
export function buildLlmPromptPayload(data) {
    const lines = [];
    lines.push(`방: 대화방(이름 미전송)`);
    lines.push(`메시지: ${data.summary.totalMessages} · 참여자: ${data.summary.participants}`);
    lines.push(`리듬: ${data.conversationPace.label} (${data.insights.rhythmScore}/100)`);
    lines.push(`참여: 지니 ${data.insights.participantGini ?? "n/a"} · 상위3 ${data.insights.top3ParticipantSharePercent}%`);
    const kw = data.keywords.slice(0, 25).map((k) => `${k.label}(${k.count})`);
    if (kw.length)
        lines.push(`키워드: ${kw.join(", ")}`);
    const topics = data.topics.slice(0, 12).map((t, i) => `${i}:${t.title} [${t.terms.slice(0, 5).join(" ")}]`);
    if (topics.length)
        lines.push(`주제후보: ${topics.join(" | ")}`);
    const bullets = data.highlights.slice(0, 15);
    if (bullets.length)
        lines.push(`하이라이트: ${bullets.join(" / ")}`);
    if (data.interaction?.topPairs?.length) {
        const pairs = data.interaction.topPairs
            .slice(0, 6)
            .map((p) => `${p.fromAlias}→${p.toAlias}(${p.replies})`);
        lines.push(`응답쌍: ${pairs.join(", ")}`);
    }
    const ev = data.roomEvents;
    if (ev.shopSearchCount > 0) {
        lines.push(`샵검색: 알림${ev.shopSearchCount} 태그추출${ev.shopSearchTagExtractions} 고유${ev.shopSearchUniqueTags}`);
    }
    const shift = data.periodCompare.keywordShift;
    if (shift.onlyHead.length || shift.onlyTail.length) {
        lines.push(`키워드전환: 초반[${shift.onlyHead.slice(0, 5).join(",")}] 후반[${shift.onlyTail.slice(0, 5).join(",")}]`);
    }
    return lines.join("\n");
}
export const LLM_SYSTEM_PROMPT = `당신은 카카오톡 대화방 통계 리포트 편집자입니다.
사용자 메시지 원문은 없습니다. 통계만 보고 JSON만 출력하세요.
형식:
{"topicTitles":[{"i":0,"title":"짧은 한국어 제목"}],"topicProposals":[{"title":"AI 코딩","terms":["클로드"],"keywordEvidence":["클로드"]}],"paragraphs":["서사 문단1","서사 문단2"]}
topicTitles는 주제후보 인덱스 i에 맞춰 최대 12개, title 40자 이내.
topicProposals는 키워드 목록에 있는 단어만 keywordEvidence에 넣어 최대 3개(새 테마 제안).
paragraphs는 2~3개, 각 120자 이내, 마크다운 **강조**만 허용.
insightBullets는 통계 근거 한 줄 2~4개(숫자는 입력에 있는 것만).
shopSearchSummary, dyadInsight는 각 120자 이내 한국어(해당 데이터 없으면 생략).`;
//# sourceMappingURL=llm-input.js.map