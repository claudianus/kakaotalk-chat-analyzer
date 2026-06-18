/** LLM 입력 — 원문 메시지·PII 없이 통계·키워드·주제만 */
export function buildLlmPromptPayload(data, opts) {
    const compact = opts?.compact === true;
    const lines = [];
    lines.push(`방: 대화방(이름 미전송)`);
    lines.push(`메시지: ${data.summary.totalMessages} · 참여자: ${data.summary.participants}`);
    if (!compact) {
        lines.push(`리듬: ${data.conversationPace.label} (${data.insights.rhythmScore}/100)`);
        lines.push(`참여: 지니 ${data.insights.participantGini ?? "n/a"} · 상위3 ${data.insights.top3ParticipantSharePercent}%`);
    }
    const kwLimit = compact ? 12 : 25;
    const kw = data.keywords.slice(0, kwLimit).map((k) => `${k.label}(${k.count})`);
    if (kw.length)
        lines.push(`키워드: ${kw.join(", ")}`);
    if (compact) {
        const evidence = data.keywords
            .slice(0, 4)
            .map((k) => k.label)
            .filter((l) => l.length >= 2);
        if (evidence.length) {
            lines.push(`증거 키워드(문장에 반드시 포함): ${evidence.join(", ")}`);
        }
    }
    const topicLimit = compact ? 6 : 12;
    const topics = data.topics
        .slice(0, topicLimit)
        .map((t, i) => `${i}:${t.title} [${t.terms.slice(0, compact ? 3 : 5).join(" ")}]`);
    if (topics.length)
        lines.push(`주제후보: ${topics.join(" | ")}`);
    const bullets = data.highlights.slice(0, compact ? 8 : 15);
    if (bullets.length)
        lines.push(`하이라이트: ${bullets.join(" / ")}`);
    const snap = data.recentSnapshot;
    if (snap && snap.weekTotal > 0) {
        lines.push(`최근7일: ${snap.weekTotal}건 · 참여 ${snap.weekParticipants}명 · 일평균 ${Math.round(snap.weekTotal / 7)}건 · 전체 대비 ${snap.weekVsOverall}배`);
        if (snap.weekKeywords.length) {
            lines.push(`최근7일키워드: ${snap.weekKeywords.slice(0, compact ? 4 : 6).join(", ")}`);
        }
    }
    if (!compact && data.interaction?.topPairs?.length) {
        const pairs = data.interaction.topPairs
            .slice(0, 6)
            .map((p) => `${p.fromAlias}→${p.toAlias}(${p.replies})`);
        lines.push(`응답쌍: ${pairs.join(", ")}`);
    }
    if (!compact) {
        const ev = data.roomEvents;
        if (ev.shopSearchCount > 0) {
            lines.push(`샵검색: 알림${ev.shopSearchCount} 태그추출${ev.shopSearchTagExtractions} 고유${ev.shopSearchUniqueTags}`);
        }
        const shift = data.periodCompare.keywordShift;
        if (shift.onlyHead.length || shift.onlyTail.length) {
            lines.push(`키워드전환: 초반[${shift.onlyHead.slice(0, 5).join(",")}] 후반[${shift.onlyTail.slice(0, 5).join(",")}]`);
        }
        if (data.story.chapters.length > 0) {
            const ch = data.story.chapters
                .slice(0, 6)
                .map((c) => `${c.label}(${c.fromDate}~${c.toDate},${c.messages}건,주도${c.topAlias ?? "—"})`);
            lines.push(`챕터: ${ch.join(" | ")}`);
        }
        if (data.burstDays.length > 0) {
            const bursts = data.burstDays
                .slice(0, 5)
                .map((b) => `${b.date}(${b.count}건)`);
            lines.push(`급증일: ${bursts.join(", ")}`);
        }
        const phrases = data.repeatedPhrases.slice(0, 8).map((p, i) => `패턴${i + 1}(${p.count})`);
        if (phrases.length)
            lines.push(`반복문구: ${phrases.join(", ")}`);
        if (data.story.personas.length > 0) {
            const personas = data.story.personas
                .slice(0, 6)
                .map((p) => `${p.alias}:${p.title}`);
            lines.push(`페르소나힌트: ${personas.join(", ")}`);
        }
    }
    const repair = opts?.repairFeedback?.trim();
    if (repair) {
        lines.push("");
        lines.push(`[수정 지시] ${repair.slice(0, 480)}`);
    }
    return lines.join("\n");
}
const TASK_CHECKLIST = `작업 순서(내부적으로만 따르고 출력하지 말 것):
1) 입력 키워드·통계 숫자 확인
2) paragraphs 2~3개 — 키워드·숫자를 문장에 포함
3) insightBullets 2~4개 — 입력에 있는 숫자만
4) roomArchetype.name/description/traits 작성
5) JSON 객체 하나만 출력`;
const OUTPUT_RULES = `출력 규칙(최우선):
- 마크다운 fence·설명·영어 오류 메시지 금지
- 입력에 없는 숫자·키워드 창작 금지
- paragraphs 각 120자 이내, **강조**만 허용
- AI 슬롭·빈말 금지(흥미롭게도, 다채로운, 활발한 소통의 장, delve, tapestry, it's worth noting 등)`;
const FULL_SCHEMA_HINT = `선택 키: topicTitles, topicProposals, insightBullets, shopSearchSummary, dyadInsight,
roomArchetype{name,description,traits[]}, moments[{headline,statRef}], relationshipBeats[{pair,beat,role}],
episodeCards, eraLabels, insideJokes, characterCards, dayMicroStories, shareLine, hashtags, counterfactuals.
topicProposals·insideJokes evidence는 입력 키워드에 있는 단어만. moments statRef는 입력 통계·하이라이트 숫자만.`;
const COMPACT_SCHEMA_HINT = `필수: paragraphs(2~3), insightBullets(2~4), roomArchetype.
선택: topicProposals(최대 2개, terms는 입력 키워드만).`;
const MINIMAL_SCHEMA_HINT = `필수 키만: paragraphs(2~3), insightBullets(2~4), roomArchetype{name,description,traits[]}.`;
/** 티어·모델 크기별 system prompt — STROT식 작업 분해 + 규칙 recency */
export function buildLlmSystemPrompt(opts) {
    const tier = opts?.tier ?? "full";
    const schemaHint = tier === "minimal"
        ? MINIMAL_SCHEMA_HINT
        : tier === "compact"
            ? COMPACT_SCHEMA_HINT
            : FULL_SCHEMA_HINT;
    const slmNote = opts?.size === "0.8B" || opts?.size === "2B"
        ? "소형 모델이므로 짧고 단순한 JSON만 출력하세요.\n"
        : "";
    return `당신은 카카오톡 대화방 통계 리포트 편집자입니다.
사용자 메시지에 원문 대화는 없습니다. 통계·키워드만 근거로 JSON을 작성합니다.
${slmNote}${schemaHint}

${TASK_CHECKLIST}

${OUTPUT_RULES}`;
}
/** @deprecated buildLlmSystemPrompt({ tier: "full" }) 사용 */
export const LLM_SYSTEM_PROMPT = buildLlmSystemPrompt({ tier: "full" });
function topKeywords(data, limit = 4) {
    return data.keywords
        .map((k) => k.label.trim())
        .filter((l) => l.length >= 2)
        .slice(0, limit);
}
/** 도메인 매칭 micro few-shot — SLM에서 정적 예시보다 효과적 */
export function buildLlmKeywordMicroExample(data) {
    const kw = topKeywords(data, 2);
    if (kw.length < 2)
        return "";
    const [a, b] = kw;
    const n = data.summary.totalMessages;
    const p = data.summary.participants;
    return `형식 참고(입력과 무관한 예시 구조):
{"paragraphs":["이 방은 **${a}**와 **${b}**가 중심인 대화입니다.","참여자 ${p}명·메시지 ${n}건 규모입니다."],"insightBullets":["상위 키워드가 ${a}·${b}에 집중됩니다."],"roomArchetype":{"name":"${a} 크루","description":"${a}와 ${b} 중심의 정보 공유","traits":["${a}","${b}"]}}`;
}
/** fill-in-the-blank JSON skeleton — constrained decoding 보조 */
export function buildLlmOutputSkeleton(data, tier) {
    const kw = topKeywords(data, 3);
    const kwHint = kw.length ? kw.join(", ") : "키워드";
    const n = data.summary.totalMessages;
    const p = data.summary.participants;
    if (tier === "minimal") {
        return `[출력 틀] 아래 구조를 입력 통계로 채우세요. 다른 키는 생략.
{"paragraphs":["**${kwHint}** 관련 첫 문단(${n}건·${p}명 반영)","두 번째 문단"],"insightBullets":["...","..."],"roomArchetype":{"name":"...","description":"...","traits":["..."]}}`;
    }
    if (tier === "compact") {
        return `[출력 틀] 필수 키를 채우고 topicProposals는 선택(최대 2).
{"paragraphs":["...","..."],"insightBullets":["..."],"roomArchetype":{"name":"...","description":"...","traits":["..."]},"topicProposals":[{"title":"...","terms":["${kw[0] ?? "키워드"}"]}]}`;
    }
    return "";
}
/** 통계 payload + skeleton + micro few-shot 조립 */
export function assembleLlmUserPrompt(data, opts) {
    const tier = opts?.schemaTier ?? (opts?.compact ? "minimal" : "full");
    const parts = [buildLlmPromptPayload(data, opts)];
    const skeleton = buildLlmOutputSkeleton(data, tier);
    if (skeleton) {
        parts.push("");
        parts.push(skeleton);
    }
    if ((tier === "minimal" || tier === "compact") && !opts?.repairFeedback?.trim()) {
        const micro = buildLlmKeywordMicroExample(data);
        if (micro) {
            parts.push("");
            parts.push(micro);
        }
    }
    return parts.join("\n");
}
//# sourceMappingURL=llm-input.js.map