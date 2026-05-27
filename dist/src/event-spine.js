const MIN_EVENTS_BEFORE_ENRICH = 8;
const MAX_EVENTS = 24;
export function buildEventSpine(input) {
    const events = [];
    for (const b of input.burstDays.slice(0, 8)) {
        events.push({
            date: b.date,
            kind: "burst",
            title: "메시지 급증",
            detail: `${b.count}건 — 평소보다 활발한 날`,
            metric: b.count,
            jumpId: "s-viz",
        });
    }
    const silenceResume = findSilenceResume(input.daily, input.maxSilenceBetweenActiveDays);
    if (silenceResume)
        events.push(silenceResume);
    const roomPulseByChurn = input.roomPulse
        .map((p) => ({ pulse: p, churn: p.join + p.leave + p.kick }))
        .filter((p) => p.churn >= 5)
        .sort((a, b) => b.churn - a.churn || a.pulse.date.localeCompare(b.pulse.date))
        .slice(0, 4)
        .sort((a, b) => a.pulse.date.localeCompare(b.pulse.date));
    for (const { pulse: p, churn } of roomPulseByChurn) {
        events.push({
            date: p.date,
            kind: "room",
            title: "입·퇴장 활발",
            detail: `입장 ${p.join} · 퇴장 ${p.leave} · 강퇴 ${p.kick}`,
            metric: churn,
        });
    }
    const newcomerPulses = input.roomPulse
        .filter((p) => p.newSenders >= 3)
        .sort((a, b) => b.newSenders - a.newSenders || a.date.localeCompare(b.date))
        .slice(0, 4)
        .sort((a, b) => a.date.localeCompare(b.date));
    for (const p of newcomerPulses) {
        events.push({
            date: p.date,
            kind: "newcomer",
            title: "신규 참여자 유입",
            detail: `처음 말한 사람 ${p.newSenders}명`,
            metric: p.newSenders,
        });
    }
    for (const s of input.dailyLinkSpikes.slice(0, 4)) {
        events.push({
            date: s.date,
            kind: "links",
            title: "링크 공유 집중",
            detail: `링크 포함 메시지 ${s.links}건`,
            metric: s.links,
        });
    }
    for (const r of input.repeatedPhrases.slice(0, 3)) {
        const memeDate = r.peakDate ?? findPhrasePeakDate(input.daily);
        events.push({
            date: memeDate,
            kind: "meme",
            title: "반복 문구",
            detail: `「${r.label}」 ${r.count}회`,
            metric: r.count,
        });
    }
    for (const pl of input.dailyPlanSignals.filter((d) => d.hits >= 3).slice(0, 4)) {
        events.push({
            date: pl.date,
            kind: "plan",
            title: "약속·일정 신호",
            detail: `날짜·시간 표현 ${pl.hits}건 (추정)`,
            metric: pl.hits,
        });
    }
    let merged = dedupeByDateKind(events);
    if (merged.length < MIN_EVENTS_BEFORE_ENRICH) {
        merged = enrichSparseTimeline(merged, input);
    }
    return limitEventsPerDate(merged.sort((a, b) => a.date.localeCompare(b.date) || kindOrder(a.kind) - kindOrder(b.kind))).slice(0, MAX_EVENTS);
}
/** 타임라인 힌트용 활동 범위 */
export function timelineActivityRange(daily) {
    const active = daily.filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (active.length === 0)
        return null;
    return { first: active[0].date, last: active[active.length - 1].date };
}
function enrichSparseTimeline(existing, input) {
    const out = [...existing];
    const have = new Set(out.map((e) => `${e.date}\t${e.kind}`));
    const active = input.daily.filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (active.length > 0) {
        const first = active[0];
        const last = active[active.length - 1];
        const milestones = [
            {
                date: first.date,
                kind: "milestone",
                title: "대화 시작",
                detail: `첫 활동일 · ${first.count}건`,
                metric: first.count,
            },
            {
                date: last.date,
                kind: "milestone",
                title: "최근 활동",
                detail: `마지막 활동일 · ${last.count}건`,
                metric: last.count,
            },
        ];
        for (const m of milestones) {
            const key = `${m.date}\tmilestone`;
            if (!have.has(key)) {
                out.push(m);
                have.add(key);
            }
        }
    }
    const byMonth = new Map();
    for (const d of active) {
        const ym = d.date.slice(0, 7);
        const cur = byMonth.get(ym);
        if (!cur || d.count > cur.count)
            byMonth.set(ym, d);
    }
    for (const peak of byMonth.values()) {
        const key = `${peak.date}\tpeak`;
        if (have.has(key) || out.some((e) => e.date === peak.date && e.kind === "burst"))
            continue;
        out.push({
            date: peak.date,
            kind: "peak",
            title: "월간 최고 활동",
            detail: `${peak.date.slice(0, 7)} 구간 중 ${peak.count}건`,
            metric: peak.count,
        });
        have.add(key);
    }
    return dedupeByDateKind(out);
}
function limitEventsPerDate(events, maxPerDate = 2) {
    const counts = new Map();
    const out = [];
    for (const event of events) {
        const used = counts.get(event.date) ?? 0;
        if (used >= maxPerDate)
            continue;
        counts.set(event.date, used + 1);
        out.push(event);
    }
    return out;
}
function dedupeByDateKind(events) {
    const best = new Map();
    for (const e of events) {
        const key = `${e.date}\t${e.kind}`;
        const prev = best.get(key);
        if (!prev || (e.metric ?? 0) > (prev.metric ?? 0))
            best.set(key, e);
    }
    return [...best.values()];
}
function findPhrasePeakDate(daily) {
    const active = daily.filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
    return active[0]?.date ?? daily[0]?.date ?? "—";
}
function kindOrder(kind) {
    const o = {
        milestone: -1,
        burst: 0,
        meme: 1,
        peak: 2,
        silence: 3,
        room: 3,
        newcomer: 4,
        links: 5,
        plan: 6,
    };
    return o[kind] ?? 9;
}
function findSilenceResume(daily, maxGap) {
    if (maxGap === null || maxGap < 5 || daily.length < 3)
        return null;
    const sorted = [...daily].filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
    let bestGap = 0;
    let resumeDate = null;
    for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        const gap = dayDiff(prev.date, cur.date) - 1;
        if (gap > bestGap) {
            bestGap = gap;
            resumeDate = cur.date;
        }
    }
    if (!resumeDate || bestGap < 5)
        return null;
    return {
        date: resumeDate,
        kind: "silence",
        title: "긴 침묵 후 재개",
        detail: `약 ${bestGap}일 쉰 뒤 대화가 다시 이어짐`,
        metric: bestGap,
    };
}
function dayDiff(a, b) {
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return Math.round(ms / 86_400_000);
}
//# sourceMappingURL=event-spine.js.map