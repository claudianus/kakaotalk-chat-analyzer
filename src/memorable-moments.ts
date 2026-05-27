import type { DailyCount, DailyHotTopic, DailySentiment, LlmInsights, MemorableMoment } from "./types.js";

const TYPE_ICONS: Record<MemorableMoment["type"], string> = {
  peak_activity: "📈",
  emotional_spike: "💥",
  milestone: "🎯",
  conflict_resolution: "🤝",
  shared_joy: "🎉",
};

const PEAK_DESCRIPTIONS = [
  "평소보다 훨씬 활발했던 날이에요! {count}건의 메시지가 쏟아졌어요.",
  "이날은 무슨 일이 있었나요? {count}건으로 평소의 2배 이상이에요.",
  "대화의 불꽃이 튀었던 날! 총 {count}건의 메시지가 오갔어요.",
  "평범하지 않은 하루였어요. {count}건이나 주고받았네요!",
  "우와, {count}건! 이 날만큼은 말문이 트였던 것 같아요.",
];

const EMOTIONAL_SPIKE_UP_DESCRIPTIONS = [
  "긍정 에너지가 급등했어요. 에너지 지수 {curr}(전날 {prev}).",
  "기분 좋은 날이었나 봐요! 긍정 지수가 {prev}에서 {curr}로 치솟았어요.",
  "활기 넘치는 대화였어요. 에너지가 {prev} → {curr}로 상승!",
];

const EMOTIONAL_SPIKE_DOWN_DESCRIPTIONS = [
  "부정 에너지가 급등했어요. 에너지 지수 {curr}(전날 {prev}).",
  "조금 무거운 날이었나 봐요. 에너지 지수가 {prev}에서 {curr}로 하락했어요.",
  "대화 톤이 가라앉았어요. 에너지 {prev} → {curr}.",
];

const MILESTONE_FIRST_DESCRIPTIONS = [
  "대화가 시작되었어요. 첫 메시지가 별냈네요!",
  "첫 인사가 오갔던 날, 이야기의 시작이에요.",
];

const MILESTONE_LAST_DESCRIPTIONS = [
  "마지막 메시지가 별냈어요.",
  "이날이 기록상 마지막 대화예요.",
];

const MILESTONE_NUMBER_DESCRIPTIONS = [
  "{n}번째 메시지가 별냈어요! 🎉",
  "대화가 {n}건을 돌파했어요. 기념할 만한 순간!",
  "벌써 {n}번째 메시지라니, 놀라워요!",
];

const SHARED_JOY_DESCRIPTIONS = [
  "{count}건의 메시지가 오갔어요. 웃음 가득한 날이었나 봐요!",
  "활기찬 대화의 날! {count}건이나 나눴어요.",
  "이날은 특별했어요. {count}건의 메시지로 가득 찼네요.",
];

const CONFLICT_RESOLUTION_DESCRIPTIONS = [
  "부정적 분위기에서 긍정적으로 전환했어요. 부정 {prevNeg}% → {currNeg}%, 긍정 {prevPos}% → {currPos}%.",
  "갈등이 해소된 듯해요. 부정 {prevNeg}% → {currNeg}%, 긍정 {prevPos}% → {currPos}%.",
  "다시 화해의 미소를 찾은 날! 부정 {prevNeg}% → {currNeg}%, 긍정 {prevPos}% → {currPos}%.",
];

export function getTypeIcon(type: MemorableMoment["type"]): string {
  return TYPE_ICONS[type] ?? "💬";
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function enhanceMemorableMomentsWithLlm(
  moments: MemorableMoment[],
  llmInsights: LlmInsights | undefined
): MemorableMoment[] {
  if (!llmInsights || !llmInsights.moments || llmInsights.moments.length === 0) {
    return moments;
  }

  return moments.map((m) => {
    // 날짜 기반으로 LLM moment 매칭 시도
    const relatedLlmMoment = llmInsights.moments!.find(
      (lm) => lm.statRef && m.date.includes(lm.statRef)
    );
    if (relatedLlmMoment) {
      return {
        ...m,
        description: relatedLlmMoment.headline,
      };
    }
    return m;
  });
}

export function extractMemorableMoments(params: {
  daily: DailyCount[];
  dailySentiment: DailySentiment[];
  totalMessages: number;
  firstMessageDate: string | null;
  lastMessageDate: string | null;
  dailyHotTopics?: DailyHotTopic[];
}): MemorableMoment[] {
  const { daily, dailySentiment, totalMessages, firstMessageDate, lastMessageDate } = params;
  const topicByDate = new Map((params.dailyHotTopics ?? []).map((t) => [t.date, t]));
  const moments: MemorableMoment[] = [];

  moments.push(...extractPeakDays(daily));
  moments.push(...extractEmotionalSpikes(dailySentiment));
  moments.push(...extractMilestones(daily, totalMessages, firstMessageDate, lastMessageDate));
  moments.push(...extractSharedJoy(daily));
  moments.push(...extractConflictResolution(dailySentiment));

  const seen = new Set<string>();
  const unique = moments
    .filter((m) => {
      const key = `${m.date}|${m.type}|${m.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((m) => contextualizeMoment(m, topicByDate.get(m.date)));

  return selectMemorableMoments(unique);
}

function contextualizeMoment(moment: MemorableMoment, topic: DailyHotTopic | undefined): MemorableMoment {
  if (!topic) return moment;
  const topicKeywords = topic.keywords.slice(0, 3);
  const mergedKeywords = moment.keywords.length > 0 ? moment.keywords : topicKeywords;
  const participants = moment.participants.length > 0 ? moment.participants : (topic.participants ?? []);
  const title = moment.type === "milestone"
    ? `${moment.title} · ${topic.title}`
    : `${moment.title} · ${topic.title}`;
  return {
    ...moment,
    title,
    description: topic.summary,
    evidence: topic.evidence,
    participants,
    keywords: mergedKeywords,
  };
}

function selectMemorableMoments(moments: MemorableMoment[]): MemorableMoment[] {
  const typeLimit = new Map<MemorableMoment["type"], number>();
  const ranked = [...moments].sort((a, b) => momentScore(b) - momentScore(a) || a.date.localeCompare(b.date));
  const picked: MemorableMoment[] = [];
  for (const m of ranked) {
    const used = typeLimit.get(m.type) ?? 0;
    if (used >= 2) continue;
    typeLimit.set(m.type, used + 1);
    picked.push(m);
    if (picked.length >= 8) break;
  }
  return picked.sort((a, b) => a.date.localeCompare(b.date));
}

function momentScore(moment: MemorableMoment): number {
  const typeWeight: Record<MemorableMoment["type"], number> = {
    peak_activity: 50,
    emotional_spike: 44,
    shared_joy: 38,
    conflict_resolution: 36,
    milestone: 22,
  };
  const keywordBonus = moment.keywords.length > 0 ? 12 : 0;
  return typeWeight[moment.type] + keywordBonus + Math.log10(Math.max(moment.messageCount, 1));
}

function extractPeakDays(daily: DailyCount[]): MemorableMoment[] {
  if (daily.length === 0) return [];
  const avg = daily.reduce((s, d) => s + d.count, 0) / daily.length;
  const threshold = avg * 2;
  const peaks = daily.filter((d) => d.count >= threshold);
  return peaks.map((d) => ({
    date: d.date,
    type: "peak_activity" as const,
    title: "대화 폭발일",
    description: pick(PEAK_DESCRIPTIONS).replace("{count}", String(d.count)),
    messageCount: d.count,
    participants: [],
    keywords: [],
  }));
}

function extractEmotionalSpikes(dailySentiment: DailySentiment[]): MemorableMoment[] {
  if (dailySentiment.length < 3) return [];
  const moments: MemorableMoment[] = [];
  for (let i = 1; i < dailySentiment.length - 1; i += 1) {
    const prev = dailySentiment[i - 1];
    const curr = dailySentiment[i];
    const next = dailySentiment[i + 1];
    const prevEnergy = prev.energy;
    const currEnergy = curr.energy;
    const nextEnergy = next.energy;
    // 급등: 이전보다 30%p 이상 상승하고 다음날 유지 또는 하락
    if (currEnergy - prevEnergy >= 30) {
      moments.push({
        date: curr.date,
        type: "emotional_spike" as const,
        title: "감정 고조일",
        description: pick(EMOTIONAL_SPIKE_UP_DESCRIPTIONS)
          .replace("{curr}", String(Math.round(currEnergy)))
          .replace("{prev}", String(Math.round(prevEnergy))),
        messageCount: 0,
        participants: [],
        keywords: [],
      });
    }
    // 급락: 이전보다 30%p 이상 하락하고 다음날 유지 또는 상승
    if (prevEnergy - currEnergy >= 30) {
      moments.push({
        date: curr.date,
        type: "emotional_spike" as const,
        title: "감정 저조일",
        description: pick(EMOTIONAL_SPIKE_DOWN_DESCRIPTIONS)
          .replace("{curr}", String(Math.round(currEnergy)))
          .replace("{prev}", String(Math.round(prevEnergy))),
        messageCount: 0,
        participants: [],
        keywords: [],
      });
    }
  }
  return moments;
}

function extractMilestones(
  daily: DailyCount[],
  totalMessages: number,
  firstMessageDate: string | null,
  lastMessageDate: string | null,
): MemorableMoment[] {
  const moments: MemorableMoment[] = [];

  // 첫 메시지
  if (firstMessageDate) {
    moments.push({
      date: firstMessageDate.slice(0, 10),
      type: "milestone" as const,
      title: "첫 대화",
      description: pick(MILESTONE_FIRST_DESCRIPTIONS),
      messageCount: 1,
      participants: [],
      keywords: [],
    });
  }

  // 마지막 메시지
  if (lastMessageDate) {
    moments.push({
      date: lastMessageDate.slice(0, 10),
      type: "milestone" as const,
      title: "마지막 대화",
      description: pick(MILESTONE_LAST_DESCRIPTIONS),
      messageCount: 1,
      participants: [],
      keywords: [],
    });
  }

  // 1000, 10000 등 기념 메시지 (daily 데이터에서 근사)
  const milestoneNumbers = [1000, 5000, 10000, 50000, 100000];
  for (const n of milestoneNumbers) {
    if (totalMessages >= n && daily.length > 0) {
      // 근사: n번째 메시지가 속한 날짜 추정
      let cumulative = 0;
      let milestoneDate = daily[0].date;
      let milestoneDayKeywords: string[] = [];
      for (const d of daily) {
        cumulative += d.count;
        if (cumulative >= n) {
          milestoneDate = d.date;
          milestoneDayKeywords = [];
          break;
        }
      }
      moments.push({
        date: milestoneDate,
        type: "milestone" as const,
        title: `${n.toLocaleString()}번째 메시지`,
        description: pick(MILESTONE_NUMBER_DESCRIPTIONS).replace("{n}", n.toLocaleString()),
        messageCount: n,
        participants: [],
        keywords: milestoneDayKeywords,
      });
    }
  }

  return moments;
}

function extractSharedJoy(daily: DailyCount[]): MemorableMoment[] {
  if (daily.length === 0) return [];

  // 상위 10% 메시지량 날짜를 "활발한 대화일"로 근사
  const sorted = [...daily].sort((a, b) => b.count - a.count);
  const topCount = Math.max(1, Math.ceil(daily.length * 0.1));
  const topDays = sorted.slice(0, topCount);

  return topDays.map((d) => ({
    date: d.date,
    type: "shared_joy" as const,
    title: "활발한 대화일",
    description: pick(SHARED_JOY_DESCRIPTIONS).replace("{count}", String(d.count)),
    messageCount: d.count,
    participants: [],
    keywords: [],
  }));
}

function extractConflictResolution(dailySentiment: DailySentiment[]): MemorableMoment[] {
  if (dailySentiment.length < 3) return [];
  const moments: MemorableMoment[] = [];
  for (let i = 1; i < dailySentiment.length; i += 1) {
    const prev = dailySentiment[i - 1];
    const curr = dailySentiment[i];
    // 부정 -> 긍정 급변
    if (prev.negative > 40 && curr.negative < 20 && curr.positive > prev.positive + 20) {
      moments.push({
        date: curr.date,
        type: "conflict_resolution" as const,
        title: "갈등 해결",
        description: pick(CONFLICT_RESOLUTION_DESCRIPTIONS)
          .replace("{prevNeg}", String(Math.round(prev.negative)))
          .replace("{currNeg}", String(Math.round(curr.negative)))
          .replace("{prevPos}", String(Math.round(prev.positive)))
          .replace("{currPos}", String(Math.round(curr.positive))),
        messageCount: 0,
        participants: [],
        keywords: [],
      });
    }
  }
  return moments;
}
