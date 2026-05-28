const TYPE_ICONS = {
    peak_activity: "📈",
    emotional_spike: "💥",
    milestone: "🎯",
    conflict_resolution: "🤝",
    shared_joy: "🎉",
};
const PEAK_DESCRIPTIONS = [
    "{count}건. 평소의 2배 이상이 쏟아진 날.",
    "{count}건이 오간 하루.",
    "메시지 {count}건 — 이 방에서 가장 붐볐던 날 중 하나.",
];
const EMOTIONAL_SPIKE_UP_DESCRIPTIONS = [
    "에너지 지수 {prev} → {curr}. 하루 만에 급등.",
    "긍정 톤이 {prev}에서 {curr}로 뛰어올랐어요.",
];
const EMOTIONAL_SPIKE_DOWN_DESCRIPTIONS = [
    "에너지 지수 {prev} → {curr}. 하루 만에 급락.",
    "대화 톤이 {prev}에서 {curr}로 내려앉았어요.",
];
const MILESTONE_FIRST_DESCRIPTIONS = [
    "첫 메시지가 오간 날.",
    "이 방의 첫 대화.",
];
const MILESTONE_LAST_DESCRIPTIONS = [
    "기록상 마지막 메시지가 오간 날.",
    "이 방의 마지막 대화.",
];
const MILESTONE_NUMBER_DESCRIPTIONS = [
    "{n}번째 메시지가 이날 오갔어요.",
    "누적 {n}건을 넘긴 날.",
];
const SHARED_JOY_DESCRIPTIONS = [
    "메시지 {count}건. 대화가 집중된 날.",
    "{count}건이 오간 활발한 하루.",
];
const CONFLICT_RESOLUTION_DESCRIPTIONS = [
    "부정 {prevNeg}% → {currNeg}%, 긍정 {prevPos}% → {currPos}%. 분위기가 반전된 날.",
    "톤이 부정 {prevNeg}%에서 {currNeg}%로 내려가고 긍정 {currPos}%로 올랐어요.",
];
export function getTypeIcon(type) {
    return TYPE_ICONS[type] ?? "💬";
}
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
export function enhanceMemorableMomentsWithLlm(moments, llmInsights) {
    if (!llmInsights || !llmInsights.moments || llmInsights.moments.length === 0) {
        return moments;
    }
    return moments.map((m) => {
        // 날짜 기반으로 LLM moment 매칭 시도
        const relatedLlmMoment = llmInsights.moments.find((lm) => lm.statRef && m.date.includes(lm.statRef));
        if (relatedLlmMoment) {
            return {
                ...m,
                description: relatedLlmMoment.headline,
            };
        }
        return m;
    });
}
export function extractMemorableMoments(params) {
    const { daily, dailySentiment, totalMessages, firstMessageDate, lastMessageDate } = params;
    const topicByDate = new Map((params.dailyHotTopics ?? []).map((t) => [t.date, t]));
    const moments = [];
    moments.push(...extractPeakDays(daily));
    moments.push(...extractEmotionalSpikes(dailySentiment));
    moments.push(...extractMilestones(daily, totalMessages, firstMessageDate, lastMessageDate));
    moments.push(...extractSharedJoy(daily));
    moments.push(...extractConflictResolution(dailySentiment));
    const seen = new Set();
    const unique = moments
        .filter((m) => {
        const key = `${m.date}|${m.type}|${m.title}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    })
        .map((m) => contextualizeMoment(m, topicByDate.get(m.date)));
    return selectMemorableMoments(unique);
}
function contextualizeMoment(moment, topic) {
    if (!topic)
        return moment;
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
function selectMemorableMoments(moments) {
    const typeLimit = new Map();
    const ranked = [...moments].sort((a, b) => momentScore(b) - momentScore(a) || a.date.localeCompare(b.date));
    const picked = [];
    for (const m of ranked) {
        const used = typeLimit.get(m.type) ?? 0;
        if (used >= 2)
            continue;
        typeLimit.set(m.type, used + 1);
        picked.push(m);
        if (picked.length >= 8)
            break;
    }
    return picked.sort((a, b) => a.date.localeCompare(b.date));
}
function momentScore(moment) {
    const typeWeight = {
        peak_activity: 50,
        emotional_spike: 44,
        shared_joy: 38,
        conflict_resolution: 36,
        milestone: 22,
    };
    const keywordBonus = moment.keywords.length > 0 ? 12 : 0;
    return typeWeight[moment.type] + keywordBonus + Math.log10(Math.max(moment.messageCount, 1));
}
function extractPeakDays(daily) {
    if (daily.length === 0)
        return [];
    const avg = daily.reduce((s, d) => s + d.count, 0) / daily.length;
    const threshold = avg * 2;
    const peaks = daily.filter((d) => d.count >= threshold);
    return peaks.map((d) => ({
        date: d.date,
        type: "peak_activity",
        title: "대화 폭발일",
        description: pick(PEAK_DESCRIPTIONS).replace("{count}", String(d.count)),
        messageCount: d.count,
        participants: [],
        keywords: [],
    }));
}
function extractEmotionalSpikes(dailySentiment) {
    if (dailySentiment.length < 3)
        return [];
    const moments = [];
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
                type: "emotional_spike",
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
                type: "emotional_spike",
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
function extractMilestones(daily, totalMessages, firstMessageDate, lastMessageDate) {
    const moments = [];
    // 첫 메시지
    if (firstMessageDate) {
        moments.push({
            date: firstMessageDate.slice(0, 10),
            type: "milestone",
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
            type: "milestone",
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
            let milestoneDayKeywords = [];
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
                type: "milestone",
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
function extractSharedJoy(daily) {
    if (daily.length === 0)
        return [];
    // 상위 10% 메시지량 날짜를 "활발한 대화일"로 근사
    const sorted = [...daily].sort((a, b) => b.count - a.count);
    const topCount = Math.max(1, Math.ceil(daily.length * 0.1));
    const topDays = sorted.slice(0, topCount);
    return topDays.map((d) => ({
        date: d.date,
        type: "shared_joy",
        title: "활발한 대화일",
        description: pick(SHARED_JOY_DESCRIPTIONS).replace("{count}", String(d.count)),
        messageCount: d.count,
        participants: [],
        keywords: [],
    }));
}
function extractConflictResolution(dailySentiment) {
    if (dailySentiment.length < 3)
        return [];
    const moments = [];
    for (let i = 1; i < dailySentiment.length; i += 1) {
        const prev = dailySentiment[i - 1];
        const curr = dailySentiment[i];
        // 부정 -> 긍정 급변
        if (prev.negative > 40 && curr.negative < 20 && curr.positive > prev.positive + 20) {
            moments.push({
                date: curr.date,
                type: "conflict_resolution",
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
//# sourceMappingURL=memorable-moments.js.map