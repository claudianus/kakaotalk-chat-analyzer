export function resolveBurstDetectionMethod() {
    return process.env.KCA_BURST_METHOD === "mad" ? "mad" : "heuristic";
}
export function computeBurstDays(daily, method = resolveBurstDetectionMethod()) {
    if (daily.length < 4)
        return [];
    if (method === "mad")
        return computeBurstDaysMad(daily);
    return computeBurstDaysHeuristic(daily);
}
function computeBurstDaysHeuristic(daily) {
    const counts = daily.map((d) => d.count).sort((a, b) => a - b);
    const median = medianSorted(counts);
    const p90 = counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.9))] ?? median;
    const activeDays = daily.length;
    const spanScale = Math.min(1, Math.max(0.35, activeDays / 120));
    const medianMult = 1.12 + 0.28 * spanScale;
    const p90Mult = 0.86 + 0.1 * spanScale;
    const floorBump = Math.max(2, Math.floor(median * (0.1 + 0.08 * spanScale)));
    const threshold = Math.max(Math.ceil(median * medianMult), Math.ceil(p90 * p90Mult), median + floorBump);
    return pickBurstCandidates(daily, threshold);
}
/** Modified z-score (MAD) — 일별 count 이상치 */
function computeBurstDaysMad(daily) {
    const counts = daily.map((d) => d.count);
    const sorted = [...counts].sort((a, b) => a - b);
    const median = medianSorted(sorted);
    const deviations = counts.map((c) => Math.abs(c - median)).sort((a, b) => a - b);
    const mad = medianSorted(deviations) || 1;
    const scaledMad = mad * 1.4826;
    const threshold = Math.max(median + 3 * scaledMad, median + 2);
    return pickBurstCandidates(daily, Math.ceil(threshold));
}
function pickBurstCandidates(daily, threshold) {
    return daily
        .filter((d) => d.count >= threshold)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}
export function computeActivityArc(daily) {
    if (daily.length === 0)
        return [];
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const sumWindow = (slice) => ({
        messages: slice.reduce((a, d) => a + d.count, 0),
        activeDays: slice.filter((d) => d.count > 0).length,
    });
    const whole = sumWindow(sorted);
    const out = [
        { id: "whole", label: "전체", messages: whole.messages, activeDays: whole.activeDays },
    ];
    const head = sorted.slice(0, Math.min(7, sorted.length));
    const tail = sorted.slice(Math.max(0, sorted.length - 7));
    if (sorted.length >= 10) {
        out.unshift({
            id: "tail",
            label: "마지막 7일",
            messages: sumWindow(tail).messages,
            activeDays: sumWindow(tail).activeDays,
        });
        out.unshift({
            id: "head",
            label: "처음 7일",
            messages: sumWindow(head).messages,
            activeDays: sumWindow(head).activeDays,
        });
    }
    return out;
}
export function computeConversationPace(ins) {
    const burst = ins.burstGapUnder1mPercent ?? 0;
    const sw = ins.speakerSwitchRatePer100;
    const gini = ins.participantGini ?? 0.4;
    const slow = ins.gapOver60mPercent ?? 0;
    if (burst >= 65 && sw >= 55) {
        return {
            label: "실시간 토론장",
            emoji: "⚡",
            detail: `화자 전환 ${sw}/100 · 1분 이내 간격 ${burst}% — 토론·오픈채팅형 템포`,
        };
    }
    if (burst >= 45 && sw >= 40) {
        return {
            label: "빠른 왕복",
            emoji: "💨",
            detail: `짧은 간격 ${burst}% · 말바꿈 ${sw}/100 — 채팅창이 잘 안 식는 편`,
        };
    }
    if (slow >= 25 && burst < 35) {
        return {
            label: "비동기형",
            emoji: "🌙",
            detail: `60분 넘는 간격 ${slow}% — 끊겨도 다시 이어지는 대화`,
        };
    }
    if (gini >= 0.75) {
        return {
            label: "소수 집중형",
            emoji: "🎯",
            detail: `참여 지니 ${gini} — 핵심 멤버 몇 명이 흐름을 잡는 방`,
        };
    }
    if (ins.rhythmScore >= 62) {
        return {
            label: "꾸준한 리듬",
            emoji: "🎵",
            detail: `리듬 점수 ${ins.rhythmScore}/100 — 밀도·연속 활동이 안정적`,
        };
    }
    return {
        label: "혼합 리듬",
        emoji: "🌊",
        detail: `리듬 ${ins.rhythmScore}/100 · 전환 ${sw}/100 — 한 가지 패턴에만 묶이지 않아요`,
    };
}
export function buildRoomPulse(sortedDates, join, leave, hidden, kick, newSenders) {
    return sortedDates.map((date) => ({
        date,
        join: join.get(date) ?? 0,
        leave: leave.get(date) ?? 0,
        hidden: hidden.get(date) ?? 0,
        kick: kick.get(date) ?? 0,
        newSenders: newSenders.get(date) ?? 0,
    }));
}
function medianSorted(sorted) {
    if (sorted.length === 0)
        return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
//# sourceMappingURL=report-enrichment.js.map