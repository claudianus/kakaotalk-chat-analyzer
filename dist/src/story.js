import { formatCompactNumber } from "./report-util.js";
const GH_MONTH_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
const MAX_CALENDAR_WEEKS = 53;
const CHAPTER_GAP_DAYS = 7;
export function buildReportStory(input) {
    const tone = buildTone(input.totalMessages, input.laughMessages, input.shortMessages, input.emojiMessages);
    const wrapped = buildWrappedCards(input, tone);
    const personas = buildPersonas(input.participants, input.laughBySender, input.shortBySender);
    const chapters = buildChapters(input.daily, input.dailySenderCounts, input.senderAliases, input.totalMessages);
    const { weeks, spanLabel, totalMessages, monthLabels } = buildCalendarGrid(input.daily);
    const headline = buildHeadline(input);
    return {
        headline,
        wrapped,
        personas,
        chapters,
        calendarWeeks: weeks,
        calendarSpanLabel: spanLabel,
        calendarTotalMessages: totalMessages,
        calendarMonthLabels: monthLabels,
        tone,
    };
}
export function buildTone(total, laugh, short, emoji) {
    const base = Math.max(total, 1);
    return {
        laughMessages: laugh,
        laughPer100: round((laugh / base) * 100, 1),
        shortMessages: short,
        shortPer100: round((short / base) * 100, 1),
        emojiPer100: round((emoji / base) * 100, 1),
    };
}
function buildTopicLine(topics) {
    if (!topics || topics.length === 0)
        return null;
    const theme = topics.find((t) => t.kind === "theme") ?? topics[0];
    if (!theme)
        return null;
    const label = theme.terms.slice(0, 4).join(" · ");
    if (!label)
        return null;
    return `요즘 화제는 **${label}** 쪽이에요.`;
}
function buildHeadline(input) {
    const room = input.chatRoomName;
    const n = formatCompactNumber(input.totalMessages);
    const parts = [`「${room}」에서 ${n} 개의 메시지가 오갔어요.`];
    const topicLine = buildTopicLine(input.topics);
    if (topicLine)
        parts.push(topicLine);
    if (input.longestStreak >= 3) {
        parts.push(`최장 **${input.longestStreak}일** 연속 대화`);
    }
    if (input.peakHour !== null) {
        parts.push(`**${input.peakHour}시**가 가장 뜨거웠고`);
    }
    if (input.insights.rhythmScore >= 60) {
        parts.push(`리듬 점수 **${input.insights.rhythmScore}**점 — 꾸준한 방이에요.`);
    }
    else if (input.participants[0]) {
        parts.push(`**${input.participants[0].alias}**님이 대화를 이끌었어요.`);
    }
    else {
        parts.push("아래 카드에서 한 장면씩 펼쳐 보세요.");
    }
    return parts.slice(0, 3).join(" ");
}
function buildWrappedCards(input, tone) {
    const cards = [];
    const top = input.participants[0];
    cards.push({
        id: "intro",
        emoji: "💬",
        title: input.chatRoomName,
        stat: formatCompactNumber(input.totalMessages),
        sub: `메시지 · ${input.activeDays}일 활동 · ${input.participants.length}명`,
    });
    if (input.firstMessage && input.lastMessage) {
        cards.push({
            id: "span",
            emoji: "📅",
            title: "이야기의 길이",
            stat: spanDaysLabel(input.firstMessage, input.lastMessage),
            sub: `${trimDate(input.firstMessage)} → ${trimDate(input.lastMessage)}`,
        });
    }
    if (input.longestStreak >= 2) {
        cards.push({
            id: "streak",
            emoji: "🔥",
            title: "끊기지 않은 날들",
            stat: `${input.longestStreak}일`,
            sub: "하루도 빠짐없이 메시지가 이어진 최장 기록",
        });
    }
    if (input.peakHour !== null) {
        cards.push({
            id: "peak-hour",
            emoji: "⏰",
            title: "제2의 거실",
            stat: `${input.peakHour}시`,
            sub: "메시지가 가장 몰린 시간대",
        });
    }
    if (top) {
        cards.push({
            id: "mvp",
            emoji: "👑",
            title: "대화의 중심",
            stat: top.alias,
            sub: `전체의 ${top.sharePercent}% · 평균 ${top.averageLength}자`,
        });
    }
    cards.push({
        id: "rhythm",
        emoji: "🎵",
        title: "방 리듬 점수",
        stat: `${input.insights.rhythmScore}`,
        sub: "참여 균형 · 연속 활동 · 밀도를 합친 0~100점",
    });
    if (input.insights.weekendSharePercent >= 15) {
        cards.push({
            id: "weekend",
            emoji: "🌴",
            title: "주말의 비중",
            stat: `${input.insights.weekendSharePercent}%`,
            sub: "토·일 메시지 비율",
        });
    }
    if (tone.laughPer100 >= 5 || tone.emojiPer100 >= 3) {
        cards.push({
            id: "vibe",
            emoji: "😂",
            title: "분위기",
            stat: `100건당 ${tone.laughPer100}건`,
            sub: `웃음·리액션 패턴 · 이모지 ${tone.emojiPer100}건/100`,
        });
    }
    cards.push({
        id: "pace",
        emoji: input.conversationPace.emoji,
        title: input.conversationPace.label,
        stat: input.insights.burstGapUnder1mPercent !== null && input.insights.burstGapUnder1mPercent >= 35
            ? `${input.insights.burstGapUnder1mPercent}%`
            : `${input.insights.speakerSwitchRatePer100}`,
        sub: input.conversationPace.detail.slice(0, 56) + (input.conversationPace.detail.length > 56 ? "…" : ""),
    });
    if (input.burstDays.length > 0) {
        const peak = input.burstDays[0];
        cards.push({
            id: "burst",
            emoji: "🔥",
            title: "붐비는 날",
            stat: formatCompactNumber(peak.count),
            sub: `${trimYmd(peak.date)} · 급증일 ${input.burstDays.length}일`,
        });
    }
    const head = input.activityArc.find((a) => a.id === "head");
    const tail = input.activityArc.find((a) => a.id === "tail");
    if (head && tail && head.messages > 0 && tail.messages > 0) {
        const ratio = Math.round((tail.messages / head.messages) * 100);
        cards.push({
            id: "arc",
            emoji: ratio >= 110 ? "📈" : ratio <= 90 ? "📉" : "↔️",
            title: "처음 vs 마지막 7일",
            stat: `${ratio}%`,
            sub: `후반/전반 메시지 · ${formatCompactNumber(tail.messages)} vs ${formatCompactNumber(head.messages)}`,
        });
    }
    const modPeak = [...input.roomPulse].sort((a, b) => b.hidden + b.kick - (a.hidden + a.kick))[0];
    if (modPeak && modPeak.hidden + modPeak.kick >= 3) {
        cards.push({
            id: "mod",
            emoji: "🛡️",
            title: "운영이 바빴던 날",
            stat: `${modPeak.hidden + modPeak.kick}`,
            sub: `${trimYmd(modPeak.date)} · 가림 ${modPeak.hidden} · 강퇴 ${modPeak.kick}`,
        });
    }
    cards.push({
        id: "deep",
        emoji: "📊",
        title: "더 깊게",
        stat: "스크롤",
        sub: "숫자 요약 · 챕터 · 연간 그리드 · 차트가 이어집니다",
    });
    return cards.slice(0, 8);
}
function trimYmd(ymd) {
    const p = ymd.split("-");
    if (p.length === 3)
        return `${Number(p[1])}/${Number(p[2])}`;
    return ymd;
}
function buildPersonas(participants, laughBySender, shortBySender) {
    const out = [];
    const usedTitles = new Map();
    for (const p of participants.slice(0, 8)) {
        const laugh = laughBySender.get(p.alias) ?? 0;
        const short = shortBySender.get(p.alias) ?? 0;
        const msg = Math.max(p.messages, 1);
        const nightPct = round((p.nightMessages / msg) * 100, 1);
        const dayPct = round(100 - nightPct, 1);
        const attachPct = round((p.attachmentMessages / msg) * 100, 1);
        const linkPct = round((p.linkMessages / msg) * 100, 1);
        const laughPct = round((laugh / msg) * 100, 1);
        const shortPct = round((short / msg) * 100, 1);
        const cands = [];
        if (p.sharePercent >= 22) {
            cands.push({
                score: p.sharePercent,
                title: "대화의 중심",
                reason: `전체 메시지의 ${p.sharePercent}%`,
            });
        }
        if (nightPct >= 18) {
            cands.push({ score: nightPct, title: "새벽 요정", reason: `심야 메시지 ${nightPct}%` });
        }
        if (dayPct >= 88 && nightPct <= 8) {
            cands.push({ score: dayPct, title: "낮 활동가", reason: `주간 메시지 ${dayPct}%` });
        }
        if (attachPct >= 12) {
            cands.push({ score: attachPct, title: "사진·첨부 장인", reason: `첨부 포함 ${attachPct}%` });
        }
        if (linkPct >= 8) {
            cands.push({ score: linkPct, title: "링크 큐레이터", reason: `링크 공유 ${linkPct}%` });
        }
        if (p.maxConsecutive >= 8) {
            cands.push({
                score: p.maxConsecutive * 3,
                title: "연속 발화",
                reason: `최대 ${p.maxConsecutive}연속 메시지`,
            });
        }
        if (p.averageLength >= 36) {
            cands.push({
                score: p.averageLength,
                title: "긴 글 작가",
                reason: `평균 ${p.averageLength}자`,
            });
        }
        if (p.averageLength <= 12 && msg >= 30) {
            cands.push({
                score: 100 - p.averageLength,
                title: "한 줄 스나이퍼",
                reason: `평균 ${p.averageLength}자`,
            });
        }
        if (laughPct >= 8) {
            cands.push({ score: laughPct, title: "분위기 메이커", reason: `리액션 톤 ${laughPct}%` });
        }
        if (shortPct >= 18) {
            cands.push({ score: shortPct, title: "짧답 요정", reason: `3자 이하 ${shortPct}%` });
        }
        if (p.messages >= 40 && p.sharePercent < 12 && p.maxConsecutive <= 4) {
            cands.push({
                score: p.messages * 0.4,
                title: "조용한 관찰자",
                reason: `꾸준히 ${p.messages}건 · 점유 ${p.sharePercent}%`,
            });
        }
        cands.sort((a, b) => b.score - a.score);
        let pick;
        for (const c of cands) {
            const used = usedTitles.get(c.title) ?? 0;
            if (used < 2) {
                pick = c;
                usedTitles.set(c.title, used + 1);
                break;
            }
        }
        if (!pick) {
            pick = cands.find((c) => !usedTitles.has(c.title)) ?? cands[0];
            if (pick)
                usedTitles.set(pick.title, (usedTitles.get(pick.title) ?? 0) + 1);
        }
        out.push({
            alias: p.alias,
            title: pick?.title ?? "다재다능 상인",
            reason: pick?.reason ?? "여러 패턴이 고르게 섞였어요",
        });
    }
    return out;
}
function buildChapters(daily, dailySenderCounts, senderAliases, totalMessages) {
    if (daily.length === 0)
        return [];
    const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
    const segments = [];
    let cur = [sorted[0]];
    for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1].date;
        const next = sorted[i].date;
        const gap = dayDiff(prev, next);
        if (gap > CHAPTER_GAP_DAYS) {
            segments.push(cur);
            cur = [];
        }
        cur.push(sorted[i]);
    }
    segments.push(cur);
    return segments.map((days, index) => {
        const fromDate = days[0].date;
        const toDate = days[days.length - 1].date;
        const messages = days.reduce((a, d) => a + d.count, 0);
        const senderTotals = new Map();
        for (const d of days) {
            const perDay = dailySenderCounts.get(d.date);
            if (!perDay)
                continue;
            for (const [raw, c] of perDay) {
                const alias = senderAliases.get(raw) ?? raw;
                senderTotals.set(alias, (senderTotals.get(alias) ?? 0) + c);
            }
        }
        let topAlias = null;
        let topCount = 0;
        for (const [alias, c] of senderTotals) {
            if (c > topCount) {
                topCount = c;
                topAlias = alias;
            }
        }
        const topSharePercent = messages > 0 && topAlias ? round((topCount / messages) * 100, 1) : null;
        const shareOfAll = totalMessages > 0 ? round((messages / totalMessages) * 100, 1) : 0;
        return {
            index: index + 1,
            label: segments.length === 1 ? "전체 기간" : `${index + 1}장`,
            fromDate,
            toDate,
            activeDays: days.length,
            messages,
            shareOfAll,
            topAlias,
            topSharePercent,
        };
    });
}
function buildCalendarGrid(daily) {
    if (daily.length === 0) {
        return { weeks: [], spanLabel: "", totalMessages: 0, monthLabels: [] };
    }
    const map = new Map(daily.map((d) => [d.date, d.count]));
    const sorted = [...map.keys()].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    let totalMessages = 0;
    for (const c of map.values())
        totalMessages += c;
    const startMs = new Date(`${first}T12:00:00Z`);
    const endMs = new Date(`${last}T12:00:00Z`);
    const cursor = new Date(startMs);
    cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
    const gridEnd = new Date(endMs);
    gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));
    const weeks = [];
    let week = [];
    const levelThresholds = buildContributionLevelThresholds([...map.values()]);
    while (cursor <= gridEnd) {
        const y = cursor.getUTCFullYear();
        const m = pad2(cursor.getUTCMonth() + 1);
        const d = pad2(cursor.getUTCDate());
        const key = `${y}-${m}-${d}`;
        const count = map.get(key) ?? 0;
        week.push({
            date: key,
            count,
            level: count > 0 ? Math.max(1, levelFromCount(count, levelThresholds)) : 0,
        });
        if (week.length === 7) {
            weeks.push({ cells: week });
            week = [];
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (week.length > 0) {
        while (week.length < 7)
            week.push({ date: null, count: 0, level: 0 });
        weeks.push({ cells: week });
    }
    const weekCount = Math.min(MAX_CALENDAR_WEEKS, weeks.length);
    const sliced = weeks.slice(-weekCount);
    const calendarDays = sliced.reduce((n, w) => n + w.cells.filter((c) => c.date).length, 0);
    const activeDays = sorted.length;
    return {
        weeks: sliced,
        spanLabel: `${first} ~ ${last} · 활동 ${weekCount}주 · ${calendarDays}일(메시지 ${activeDays}일)`,
        totalMessages,
        monthLabels: buildMonthLabels(sliced),
    };
}
/** GitHub 잔디와 같이 활동 분포 사분위로 4단계 + 빈 칸 */
function buildContributionLevelThresholds(counts) {
    const positive = counts.filter((c) => c > 0).sort((a, b) => a - b);
    if (positive.length === 0)
        return [];
    if (positive.length === 1)
        return [positive[0]];
    const pick = (p) => positive[Math.min(positive.length - 1, Math.max(0, Math.ceil(p * positive.length) - 1))];
    const t1 = pick(0.25);
    const t2 = pick(0.5);
    const t3 = pick(0.75);
    const max = positive[positive.length - 1];
    return [...new Set([t1, t2, t3, max])].sort((a, b) => a - b);
}
function levelFromCount(count, thresholds) {
    if (count <= 0)
        return 0;
    if (thresholds.length === 0)
        return 1;
    let level = 0;
    for (const t of thresholds) {
        if (count >= t)
            level += 1;
    }
    return Math.min(4, level);
}
function buildMonthLabels(weeks) {
    const labels = [];
    let lastMonth = -1;
    for (let wi = 0; wi < weeks.length; wi++) {
        const firstInWeek = weeks[wi].cells.find((c) => c.date);
        if (!firstInWeek?.date)
            continue;
        const month = Number.parseInt(firstInWeek.date.slice(5, 7), 10) - 1;
        if (month !== lastMonth && month >= 0 && month < 12) {
            labels.push({ weekIndex: wi, label: GH_MONTH_KO[month] });
            lastMonth = month;
        }
    }
    return labels;
}
function dayDiff(a, b) {
    const ta = new Date(`${a}T12:00:00Z`).getTime();
    const tb = new Date(`${b}T12:00:00Z`).getTime();
    return Math.round((tb - ta) / 86_400_000);
}
function trimDate(dt) {
    const m = dt.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? dt;
}
function spanDaysLabel(first, last) {
    const a = trimDate(first);
    const b = trimDate(last);
    const days = dayDiff(a, b) + 1;
    return `${days}일`;
}
function pad2(n) {
    return n.toString().padStart(2, "0");
}
function round(n, d) {
    const f = 10 ** d;
    return Math.round(n * f) / f;
}
//# sourceMappingURL=story.js.map