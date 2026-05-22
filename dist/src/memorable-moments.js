const TYPE_ICONS = {
    peak_activity: "📈",
    emotional_spike: "💥",
    milestone: "🎯",
    conflict_resolution: "🤝",
    shared_joy: "🎉",
};
export function getTypeIcon(type) {
    return TYPE_ICONS[type] ?? "💬";
}
export function extractMemorableMoments(params) {
    const { daily, dailySentiment, totalMessages, firstMessageDate, lastMessageDate } = params;
    const moments = [];
    moments.push(...extractPeakDays(daily));
    moments.push(...extractEmotionalSpikes(dailySentiment));
    moments.push(...extractMilestones(daily, totalMessages, firstMessageDate, lastMessageDate));
    moments.push(...extractSharedJoy(daily));
    moments.push(...extractConflictResolution(dailySentiment));
    // 중복 제거 및 정렬
    const seen = new Set();
    const unique = moments.filter((m) => {
        const key = `${m.date}|${m.type}|${m.title}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    return unique.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);
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
        description: `평소 평균(${Math.round(avg)}건)의 2배 이상인 ${d.count}건의 메시지가 오갔어요.`,
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
                description: `긍정 에너지가 급등했어요. 에너지 지수 ${Math.round(currEnergy)}(전날 ${Math.round(prevEnergy)}).`,
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
                description: `부정 에너지가 급등했어요. 에너지 지수 ${Math.round(currEnergy)}(전날 ${Math.round(prevEnergy)}).`,
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
            description: `대화가 시작되었어요.`,
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
            description: `마지막 메시지가 볃냈어요.`,
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
            for (const d of daily) {
                cumulative += d.count;
                if (cumulative >= n) {
                    milestoneDate = d.date;
                    break;
                }
            }
            moments.push({
                date: milestoneDate,
                type: "milestone",
                title: `${n.toLocaleString()}번째 메시지`,
                description: `${n.toLocaleString()}번째 메시지가 볃냈어요.`,
                messageCount: n,
                participants: [],
                keywords: [],
            });
        }
    }
    return moments;
}
function extractSharedJoy(daily) {
    if (daily.length === 0)
        return [];
    // 상위 10% 메시지량 날짜를 "웃음 폭발일"로 근사
    const sorted = [...daily].sort((a, b) => b.count - a.count);
    const topCount = Math.max(1, Math.ceil(daily.length * 0.1));
    const topDays = sorted.slice(0, topCount);
    return topDays.map((d) => ({
        date: d.date,
        type: "shared_joy",
        title: "활발한 대화일",
        description: `${d.count}건의 메시지가 오갔어요.`,
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
                description: `부정적 분위기에서 긍정적으로 전환했어요. 부정 ${Math.round(prev.negative)}% → ${Math.round(curr.negative)}%, 긍정 ${Math.round(prev.positive)}% → ${Math.round(curr.positive)}%.`,
                messageCount: 0,
                participants: [],
                keywords: [],
            });
        }
    }
    return moments;
}
//# sourceMappingURL=memorable-moments.js.map