import type { ReportData } from "./types.js";

export interface BuildLlmPromptOptions {
  compact?: boolean;
}

/** LLM 입력 — 원문 메시지·PII 없이 통계·키워드·주제만 */
export function buildLlmPromptPayload(data: ReportData, opts?: BuildLlmPromptOptions): string {
  const compact = opts?.compact === true;
  const lines: string[] = [];
  lines.push(`방: 대화방(이름 미전송)`);
  lines.push(`메시지: ${data.summary.totalMessages} · 참여자: ${data.summary.participants}`);
  if (!compact) {
    lines.push(`리듬: ${data.conversationPace.label} (${data.insights.rhythmScore}/100)`);
    lines.push(
      `참여: 지니 ${data.insights.participantGini ?? "n/a"} · 상위3 ${data.insights.top3ParticipantSharePercent}%`,
    );
  }

  const kwLimit = compact ? 12 : 25;
  const kw = data.keywords.slice(0, kwLimit).map((k) => `${k.label}(${k.count})`);
  if (kw.length) lines.push(`키워드: ${kw.join(", ")}`);

  const topicLimit = compact ? 6 : 12;
  const topics = data.topics
    .slice(0, topicLimit)
    .map((t, i) => `${i}:${t.title} [${t.terms.slice(0, compact ? 3 : 5).join(" ")}]`);
  if (topics.length) lines.push(`주제후보: ${topics.join(" | ")}`);

  const bullets = data.highlights.slice(0, compact ? 8 : 15);
  if (bullets.length) lines.push(`하이라이트: ${bullets.join(" / ")}`);

  if (!compact && data.interaction?.topPairs?.length) {
    const pairs = data.interaction.topPairs
      .slice(0, 6)
      .map((p) => `${p.fromAlias}→${p.toAlias}(${p.replies})`);
    lines.push(`응답쌍: ${pairs.join(", ")}`);
  }

  if (!compact) {
    const ev = data.roomEvents;
    if (ev.shopSearchCount > 0) {
      lines.push(
        `샵검색: 알림${ev.shopSearchCount} 태그추출${ev.shopSearchTagExtractions} 고유${ev.shopSearchUniqueTags}`,
      );
    }

    const shift = data.periodCompare.keywordShift;
    if (shift.onlyHead.length || shift.onlyTail.length) {
      lines.push(
        `키워드전환: 초반[${shift.onlyHead.slice(0, 5).join(",")}] 후반[${shift.onlyTail.slice(0, 5).join(",")}]`,
      );
    }

    if (data.story.chapters.length > 0) {
      const ch = data.story.chapters
        .slice(0, 6)
        .map(
          (c) =>
            `${c.label}(${c.fromDate}~${c.toDate},${c.messages}건,주도${c.topAlias ?? "—"})`,
        );
      lines.push(`챕터: ${ch.join(" | ")}`);
    }

    if (data.burstDays.length > 0) {
      const bursts = data.burstDays
        .slice(0, 5)
        .map((b) => `${b.date}(${b.count}건)`);
      lines.push(`급증일: ${bursts.join(", ")}`);
    }

    const phrases = data.repeatedPhrases.slice(0, 8).map((p) => `${p.label}(${p.count})`);
    if (phrases.length) lines.push(`반복문구: ${phrases.join(", ")}`);

    if (data.story.personas.length > 0) {
      const personas = data.story.personas
        .slice(0, 6)
        .map((p) => `${p.alias}:${p.title}`);
      lines.push(`페르소나힌트: ${personas.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export const LLM_SYSTEM_PROMPT = `당신은 카카오톡 대화방 통계 리포트 편집자입니다.
사용자 메시지 원문은 없습니다. 통계만 보고 JSON 객체 하나만 출력하세요. 다른 텍스트·마크다운 fence 금지.
필수 키: paragraphs (2~3개 문자열).
선택 키: topicTitles, topicProposals, insightBullets, shopSearchSummary, dyadInsight,
roomArchetype{name,description,traits[]}, moments[{headline,statRef}], relationshipBeats[{pair,beat,role}],
episodeCards[{period,title,tagline,emoji}], eraLabels[{label,detail}], insideJokes[{label,whyFunny,evidenceKeywords[]}(키워드 목록 단어만)],
characterCards[{alias,tagline,statHook}], dayMicroStories[{date,line}], shareLine, hashtags[], counterfactuals[{text}](가상 유머).
topicProposals·insideJokes의 evidence는 입력 키워드에 있는 단어만.
moments의 statRef 숫자는 입력 통계·하이라이트에 있는 것만.
paragraphs는 2~3개, 각 120자 이내, 마크다운 **강조**만 허용.
insightBullets 2~4개(숫자는 입력에 있는 것만).`;
