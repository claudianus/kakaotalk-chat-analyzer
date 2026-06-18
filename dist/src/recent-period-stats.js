import { computeGini } from "./accumulator/aggregator-helpers.js";
function round1(n) {
    return Math.round(n * 10) / 10;
}
function aggregateWeekSenders(weekDates, dailySenderCounts, aliases) {
    const out = new Map();
    for (const date of weekDates) {
        const senderMap = dailySenderCounts.get(date);
        if (!senderMap)
            continue;
        for (const [raw, count] of senderMap) {
            const alias = aliases.get(raw) ?? raw;
            out.set(alias, (out.get(alias) ?? 0) + count);
        }
    }
    return out;
}
function top3SharePercent(counts, total) {
    if (total <= 0 || counts.length === 0)
        return 0;
    const top3 = [...counts].sort((a, b) => b - a).slice(0, 3).reduce((s, c) => s + c, 0);
    return round1((top3 / total) * 100);
}
function weekendShareForDates(daily, dates) {
    let weekend = 0;
    let total = 0;
    for (const date of dates) {
        const count = daily.get(date) ?? 0;
        total += count;
        const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
        if (dow === 0 || dow === 6)
            weekend += count;
    }
    return total > 0 ? round1((weekend / total) * 100) : 0;
}
function nightShareForDates(dailyHourly, dates) {
    let night = 0;
    let total = 0;
    for (const date of dates) {
        const hourly = dailyHourly.get(date);
        if (!hourly)
            continue;
        for (let h = 0; h < 24; h++) {
            const c = hourly[h] ?? 0;
            total += c;
            if (h >= 23 || h <= 5)
                night += c;
        }
    }
    return total > 0 ? round1((night / total) * 100) : 0;
}
export function buildRecentPeriodInsights(input) {
    const { recentSnapshot: snap, dailySenderCounts, dailyHourly, daily, aliases, whole } = input;
    const weekDates = snap.week.map((d) => d.date);
    const weekSenderMap = aggregateWeekSenders(weekDates, dailySenderCounts, aliases);
    const weekSenderCounts = [...weekSenderMap.values()];
    const weekTotal = snap.weekTotal;
    const weekMsgsPerDay = round1(weekTotal / 7);
    const weekGini = computeGini(weekSenderCounts);
    const weekTop3 = top3SharePercent(weekSenderCounts, weekTotal);
    const weekWeekend = weekendShareForDates(daily, weekDates);
    const weekNight = nightShareForDates(dailyHourly, weekDates);
    const weekTopSenders = [...weekSenderMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([alias, count]) => ({
        alias,
        count,
        sharePercent: weekTotal > 0 ? round1((count / weekTotal) * 100) : 0,
    }));
    const fmtPct = (n) => `${n}%`;
    const fmtGini = (n) => (n === null ? "—" : String(n));
    const fmtNum = (n) => String(n);
    return {
        weekTopSenders,
        metrics: [
            {
                key: "msgsPerDay",
                label: "일평균 메시지",
                whole: fmtNum(round1(whole.avgDailyMessages)),
                week: fmtNum(weekMsgsPerDay),
            },
            {
                key: "participants",
                label: "참여자",
                whole: fmtNum(whole.participants),
                week: fmtNum(snap.weekParticipants),
            },
            {
                key: "top3",
                label: "상위3 점유",
                whole: fmtPct(whole.top3ParticipantSharePercent),
                week: fmtPct(weekTop3),
            },
            {
                key: "gini",
                label: "참여 지니",
                whole: fmtGini(whole.participantGini),
                week: fmtGini(weekGini),
            },
            {
                key: "weekend",
                label: "주말%",
                whole: fmtPct(whole.weekendSharePercent),
                week: fmtPct(weekWeekend),
            },
            {
                key: "night",
                label: "심야%",
                whole: fmtPct(whole.nightSharePercent),
                week: fmtPct(weekNight),
            },
        ],
    };
}
//# sourceMappingURL=recent-period-stats.js.map