import { basename } from "node:path";
import { formatDate, formatDateTime, partsToUtcMs, weekdayIndex } from "./date.js";
const ATTACHMENT_MARKERS = [
    "사진",
    "동영상",
    "파일",
    "이모티콘",
    "지도",
    "연락처",
    "투표",
    "공유",
    "음성메시지",
    "삭제된 메시지",
];
const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const TOKEN_RE = /[가-힣A-Za-z][가-힣A-Za-z0-9_+-]{1,}/g;
const STOPWORDS = new Set([
    "그리고",
    "그냥",
    "근데",
    "그래서",
    "저는",
    "제가",
    "우리",
    "오늘",
    "내일",
    "어제",
    "이거",
    "저거",
    "그거",
    "수정",
    "확인",
    "가능",
    "입니다",
    "합니다",
    "있습니다",
    "없는",
    "있는",
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "http",
    "https",
]);
const NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4, 5]);
const MAX_GAP_MS = 7 * 24 * 60 * 60 * 1000;
export function buildReportData(result, options) {
    const top = options?.top ?? 30;
    const privacy = options?.privacy ?? "public-masked";
    const aliases = buildSenderLabels(result.records, privacy);
    const senderStats = new Map();
    const daily = new Map();
    const monthly = new Map();
    const hourly = Array.from({ length: 24 }, () => 0);
    const weekdays = Array.from({ length: 7 }, () => 0);
    const attachments = new Map();
    const domains = new Map();
    const keywords = new Map();
    const senderNames = new Set(result.records.map((record) => normalizeToken(record.sender)));
    let totalCharacters = 0;
    let messagesWithLinks = 0;
    let messagesWithAttachments = 0;
    let nightMessages = 0;
    let emojiMessages = 0;
    let weekendMessages = 0;
    let questionMessages = 0;
    let speakerSwitches = 0;
    let monologueMessages = 0;
    const gapsMs = [];
    let prevMs = null;
    let prevSender = null;
    let runSender = null;
    let runLen = 0;
    for (const record of result.records) {
        if (prevSender !== null && record.sender !== prevSender) {
            speakerSwitches += 1;
        }
        const alias = aliases.get(record.sender) ?? "???";
        const stat = getParticipantStat(senderStats, alias);
        const messageLength = record.message.length;
        const foundAttachments = getAttachmentMarkers(record.message);
        const foundDomains = getDomains(record.message);
        const ms = partsToUtcMs(record.date);
        if (/\p{Extended_Pictographic}/u.test(record.message)) {
            emojiMessages += 1;
        }
        if (/\?|？/.test(record.message)) {
            questionMessages += 1;
        }
        const wi = weekdayIndex(record.date);
        if (wi === 0 || wi === 6) {
            weekendMessages += 1;
        }
        if (NIGHT_HOURS.has(record.date.hour)) {
            nightMessages += 1;
            stat.nightMessages += 1;
        }
        if (prevMs !== null) {
            const delta = ms - prevMs;
            if (delta > 0 && delta <= MAX_GAP_MS)
                gapsMs.push(delta);
        }
        prevMs = ms;
        if (record.sender === prevSender) {
            runLen += 1;
            if (runLen >= 3) {
                monologueMessages += 1;
            }
        }
        else {
            if (prevSender !== null && runSender !== null) {
                const prevAlias = aliases.get(prevSender) ?? "???";
                const prevStat = getParticipantStat(senderStats, prevAlias);
                prevStat.maxConsecutive = Math.max(prevStat.maxConsecutive, runLen);
            }
            runSender = record.sender;
            runLen = 1;
        }
        prevSender = record.sender;
        stat.messages += 1;
        stat.characters += messageLength;
        totalCharacters += messageLength;
        if (foundAttachments.length > 0) {
            stat.attachmentMessages += 1;
            messagesWithAttachments += 1;
            for (const marker of foundAttachments)
                increment(attachments, marker);
        }
        if (foundDomains.length > 0) {
            stat.linkMessages += 1;
            messagesWithLinks += 1;
            for (const domain of foundDomains)
                increment(domains, domain);
        }
        for (const keyword of extractKeywords(record.message, senderNames)) {
            increment(keywords, keyword);
        }
        const dayKey = formatDate(record.date);
        increment(daily, dayKey);
        increment(monthly, `${record.date.year}-${pad2(record.date.month)}`);
        hourly[record.date.hour] = (hourly[record.date.hour] ?? 0) + 1;
        weekdays[wi] = (weekdays[wi] ?? 0) + 1;
    }
    if (prevSender !== null && runSender !== null) {
        const prevAlias = aliases.get(prevSender) ?? "???";
        const prevStat = getParticipantStat(senderStats, prevAlias);
        prevStat.maxConsecutive = Math.max(prevStat.maxConsecutive, runLen);
    }
    const total = result.records.length;
    const participantStats = [...senderStats.values()]
        .map((stat) => {
        const sharePercent = total > 0 ? round((stat.messages / total) * 100, 1) : 0;
        return {
            alias: stat.alias,
            messages: stat.messages,
            characters: stat.characters,
            averageLength: round(stat.characters / Math.max(stat.messages, 1), 1),
            attachmentMessages: stat.attachmentMessages,
            linkMessages: stat.linkMessages,
            sharePercent,
            nightMessages: stat.nightMessages,
            maxConsecutive: stat.maxConsecutive,
        };
    })
        .sort((a, b) => b.messages - a.messages)
        .slice(0, top);
    const sortedDays = [...daily.keys()].sort();
    const longestStreak = longestDateStreak(sortedDays);
    let peakHour = null;
    let peakCount = -1;
    for (let h = 0; h < 24; h += 1) {
        const c = hourly[h] ?? 0;
        if (c > peakCount) {
            peakCount = c;
            peakHour = h;
        }
    }
    if (peakCount <= 0)
        peakHour = null;
    let busiestIdx = -1;
    let busiestCount = -1;
    for (let i = 0; i < 7; i += 1) {
        const c = weekdays[i] ?? 0;
        if (c > busiestCount) {
            busiestCount = c;
            busiestIdx = i;
        }
    }
    const busiestWeekdayLabel = busiestIdx >= 0 && busiestCount > 0 ? `${WEEKDAY_LABELS_KO[busiestIdx] ?? ""}요일` : null;
    const medianReplyGapMinutes = gapsMs.length > 0 ? round(medianSorted([...gapsMs].sort((a, b) => a - b)) / 60_000, 1) : null;
    const nightSharePercent = total > 0 ? round((nightMessages / total) * 100, 1) : 0;
    const activeDays = daily.size;
    const messagesPerActiveDay = activeDays > 0 ? round(total / activeDays, 1) : 0;
    const allMessageCounts = [...senderStats.values()].map((s) => s.messages).sort((a, b) => a - b);
    const participantGini = computeGini(allMessageCounts);
    const gapsSorted = gapsMs.length > 0 ? [...gapsMs].sort((a, b) => a - b) : [];
    const replyGapP90Minutes = gapsSorted.length > 0 ? round(quantileSorted(gapsSorted, 0.9) / 60_000, 1) : null;
    const maxSilenceBetweenActiveDays = maxSilenceGapDays(sortedDays);
    const top3ParticipantSharePercent = computeTop3Share(senderStats, total);
    const linkDomainEntropyBits = domainEntropyBits(domains);
    const densityMessagesPerCalendarDay = computeDensityPerCalendarDay(result.records, total);
    const weekendSharePercent = total > 0 ? round((weekendMessages / total) * 100, 1) : 0;
    const questionLikeMessagesPer100 = total > 0 ? round((questionMessages / total) * 100, 2) : 0;
    const speakerSwitchRatePer100 = total > 0 ? round((speakerSwitches / total) * 100, 2) : 0;
    const daypartPercents = computeDaypartPercents(hourly, total);
    const rhythmScore = computeRhythmScore({
        gini: participantGini,
        longestStreak,
        density: densityMessagesPerCalendarDay,
    });
    const linksPer100 = total > 0 ? round((messagesWithLinks / total) * 100, 2) : 0;
    const attachmentsPer100 = total > 0 ? round((messagesWithAttachments / total) * 100, 2) : 0;
    const perParticipantMsgs = [...senderStats.values()].map((s) => s.messages);
    const medianMessagesPerParticipant = perParticipantMsgs.length > 0
        ? round(medianSorted([...perParticipantMsgs].sort((a, b) => a - b)), 2)
        : null;
    let burstUnder1m = 0;
    let gapOver60m = 0;
    for (const g of gapsMs) {
        if (g < 60_000)
            burstUnder1m += 1;
        if (g > 3_600_000)
            gapOver60m += 1;
    }
    const burstGapUnder1mPercent = gapsMs.length > 0 ? round((burstUnder1m / gapsMs.length) * 100, 1) : null;
    const gapOver60mPercent = gapsMs.length > 0 ? round((gapOver60m / gapsMs.length) * 100, 1) : null;
    let activeHoursCount = 0;
    for (let h = 0; h < 24; h += 1) {
        if ((hourly[h] ?? 0) > 0)
            activeHoursCount += 1;
    }
    let keywordTokenSum = 0;
    let keywordTopCount = 0;
    for (const c of keywords.values()) {
        keywordTokenSum += c;
        keywordTopCount = Math.max(keywordTopCount, c);
    }
    const keywordTop1SharePercent = keywordTokenSum > 0 ? round((keywordTopCount / keywordTokenSum) * 100, 1) : null;
    let attachmentMarkerSum = 0;
    for (const c of attachments.values())
        attachmentMarkerSum += c;
    const photoMarkerCount = attachments.get("사진") ?? 0;
    const photoShareOfAllAttachmentMarkers = attachmentMarkerSum > 0 ? round((photoMarkerCount / attachmentMarkerSum) * 100, 1) : null;
    let maxDayMessages = 0;
    for (const c of daily.values())
        maxDayMessages = Math.max(maxDayMessages, c);
    const peakDaySharePercent = total > 0 ? round((maxDayMessages / total) * 100, 1) : 0;
    const uniqueDomainCount = domains.size;
    const replyGapCoeffVariation = gapCoeffVariation(gapsMs);
    const monologueMessagesPercent = total > 0 ? round((monologueMessages / total) * 100, 1) : 0;
    const insights = {
        weekendSharePercent,
        participantGini,
        replyGapP90Minutes,
        maxSilenceBetweenActiveDays,
        top3ParticipantSharePercent,
        linkDomainEntropyBits,
        densityMessagesPerCalendarDay,
        questionLikeMessagesPer100,
        speakerSwitchRatePer100,
        rhythmScore,
        daypartPercents,
        linksPer100,
        attachmentsPer100,
        medianMessagesPerParticipant,
        burstGapUnder1mPercent,
        gapOver60mPercent,
        activeHoursCount,
        keywordTop1SharePercent,
        photoShareOfAllAttachmentMarkers,
        monologueMessagesPercent,
        peakDaySharePercent,
        uniqueDomainCount,
        replyGapCoeffVariation,
    };
    const highlights = buildHighlights({
        total,
        topAlias: participantStats[0]?.alias ?? null,
        topShare: participantStats[0]?.sharePercent ?? null,
        busiestWeekdayLabel,
        peakHour,
        medianReplyGapMinutes,
        nightSharePercent,
        longestStreak,
        emojiMessages,
        messagesWithAttachments,
        weekendSharePercent,
        participantGini,
        replyGapP90Minutes,
        maxSilenceBetweenActiveDays,
        rhythmScore,
        burstGapUnder1mPercent,
        monologueMessagesPercent,
    });
    return {
        generatedAt: new Date().toISOString(),
        privacy,
        source: {
            fileName: "KakaoTalk export",
            encoding: result.encoding,
            physicalLines: result.physicalLines,
            warnings: result.warnings.length,
        },
        summary: {
            totalMessages: total,
            participants: aliases.size,
            activeDays,
            firstMessage: result.records[0] ? formatDateTime(result.records[0].date) : null,
            lastMessage: result.records.at(-1) ? formatDateTime(result.records.at(-1).date) : null,
            averageMessageLength: round(totalCharacters / Math.max(total, 1), 1),
            messagesWithLinks,
            messagesWithAttachments,
            messagesPerActiveDay,
            longestActiveStreakDays: longestStreak,
            peakHour,
            busiestWeekdayLabel,
            medianReplyGapMinutes,
            nightSharePercent,
            emojiMessages,
        },
        insights,
        participants: participantStats,
        daily: [...daily.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
        hourly,
        weekdays: weekdays.map((count, index) => ({ label: `${WEEKDAY_LABELS_KO[index] ?? index}요일`, count })),
        monthly: [...monthly.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
        attachments: topCounts(attachments, top),
        domains: topCounts(domains, top),
        keywords: topCounts(keywords, top),
        highlights,
    };
}
export function safeInputName(filePath) {
    const name = basename(filePath);
    return name.length > 80 ? `${name.slice(0, 77)}...` : name;
}
function getParticipantStat(stats, alias) {
    const existing = stats.get(alias);
    if (existing)
        return existing;
    const created = {
        alias,
        messages: 0,
        characters: 0,
        attachmentMessages: 0,
        linkMessages: 0,
        nightMessages: 0,
        maxConsecutive: 0,
    };
    stats.set(alias, created);
    return created;
}
function buildSenderLabels(records, privacy) {
    const unique = [];
    const seen = new Set();
    for (const r of records) {
        if (!seen.has(r.sender)) {
            seen.add(r.sender);
            unique.push(r.sender);
        }
    }
    if (privacy === "public-anonymous") {
        const map = new Map();
        unique.forEach((sender, i) => map.set(sender, `User ${String(i + 1).padStart(3, "0")}`));
        return map;
    }
    const map = new Map();
    const used = new Map();
    for (const raw of unique) {
        let base = maskPartialDisplayName(raw);
        const n = (used.get(base) ?? 0) + 1;
        used.set(base, n);
        if (n > 1)
            base = `${base}·${n}`;
        map.set(raw, base);
    }
    return map;
}
/** 참여자 실명 대신 앞·뒤 일부만 남기고 가운데는 마스킹합니다. */
export function maskPartialDisplayName(raw) {
    const s = raw.trim();
    if (!s)
        return "?";
    const chars = [...s];
    if (chars.length === 1)
        return `${chars[0]}*`;
    if (chars.length === 2)
        return `${chars[0]}*`;
    const midLen = Math.min(chars.length - 2, 6);
    const middle = "*".repeat(Math.max(1, midLen));
    return `${chars[0]}${middle}${chars[chars.length - 1]}`;
}
function getAttachmentMarkers(message) {
    return ATTACHMENT_MARKERS.filter((marker) => message.includes(marker));
}
function getDomains(message) {
    const matches = message.match(URL_RE) ?? [];
    const domains = [];
    for (const match of matches) {
        const urlText = match.startsWith("http") ? match : `https://${match}`;
        try {
            const url = new URL(urlText);
            domains.push(url.hostname.toLowerCase().replace(/^www\./, ""));
        }
        catch {
            continue;
        }
    }
    return domains;
}
function extractKeywords(message, senderNames) {
    const withoutSensitivePatterns = message
        .replace(URL_RE, " ")
        .replace(EMAIL_RE, " ")
        .replace(PHONE_RE, " ");
    const tokens = withoutSensitivePatterns.match(TOKEN_RE) ?? [];
    const keywords = [];
    for (const token of tokens) {
        const normalized = normalizeToken(token);
        if (!normalized)
            continue;
        if (normalized.length < 2 || normalized.length > 30)
            continue;
        if (STOPWORDS.has(normalized))
            continue;
        if (senderNames.has(normalized))
            continue;
        if (/^\d+$/.test(normalized))
            continue;
        keywords.push(normalized);
    }
    return keywords;
}
function normalizeToken(token) {
    return /^[A-Za-z0-9_+-]+$/.test(token) ? token.toLowerCase() : token.trim();
}
function increment(map, key, amount = 1) {
    map.set(key, (map.get(key) ?? 0) + amount);
}
function topCounts(map, limit) {
    return [...map.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, limit);
}
function round(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
function pad2(value) {
    return value.toString().padStart(2, "0");
}
function medianSorted(sorted) {
    if (sorted.length === 0)
        return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function longestDateStreak(sortedYmd) {
    if (sortedYmd.length === 0)
        return 0;
    let best = 1;
    let cur = 1;
    for (let i = 1; i < sortedYmd.length; i += 1) {
        const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
        const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
        const diffDays = Math.round((b - a) / 86_400_000);
        if (diffDays === 1) {
            cur += 1;
            best = Math.max(best, cur);
        }
        else {
            cur = 1;
        }
    }
    return best;
}
function computeGini(counts) {
    if (counts.length === 0)
        return null;
    const sorted = [...counts].sort((a, b) => a - b);
    const n = sorted.length;
    let sum = 0;
    for (const x of sorted)
        sum += x;
    if (sum === 0)
        return null;
    let num = 0;
    for (let i = 0; i < n; i += 1) {
        num += (2 * i - n + 1) * sorted[i];
    }
    return round(num / (n * sum), 3);
}
function quantileSorted(sortedAsc, p) {
    if (sortedAsc.length === 0)
        return 0;
    const pos = (sortedAsc.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi)
        return sortedAsc[lo];
    const w = pos - lo;
    return sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w;
}
function gapCoeffVariation(gaps) {
    if (gaps.length < 2)
        return null;
    let sum = 0;
    for (const g of gaps)
        sum += g;
    const mean = sum / gaps.length;
    if (mean <= 0)
        return null;
    let varAcc = 0;
    for (const g of gaps) {
        const d = g - mean;
        varAcc += d * d;
    }
    const variance = varAcc / gaps.length;
    const sd = Math.sqrt(variance);
    return round(sd / mean, 2);
}
function maxSilenceGapDays(sortedYmd) {
    if (sortedYmd.length < 2)
        return null;
    let best = 0;
    for (let i = 1; i < sortedYmd.length; i += 1) {
        const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
        const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
        const diffDays = Math.round((b - a) / 86_400_000);
        best = Math.max(best, Math.max(0, diffDays - 1));
    }
    return best;
}
function computeTop3Share(stats, total) {
    if (total === 0)
        return 0;
    const top3 = [...stats.values()]
        .map((s) => s.messages)
        .sort((a, b) => b - a)
        .slice(0, 3)
        .reduce((a, c) => a + c, 0);
    return round((top3 / total) * 100, 1);
}
function domainEntropyBits(domains) {
    let sum = 0;
    for (const c of domains.values())
        sum += c;
    if (sum === 0)
        return null;
    let h = 0;
    for (const c of domains.values()) {
        if (c <= 0)
            continue;
        const p = c / sum;
        h -= p * Math.log2(p);
    }
    return round(h, 2);
}
function computeDensityPerCalendarDay(records, total) {
    if (total === 0 || records.length === 0)
        return null;
    const first = records[0].date;
    const last = records[records.length - 1].date;
    const spanDays = Math.max(1, Math.floor((partsToUtcMs(last) - partsToUtcMs(first)) / 86_400_000) + 1);
    return round(total / spanDays, 2);
}
function computeDaypartPercents(hourly, total) {
    const bands = [
        { key: "dawn", label: "새벽(0~5시)", lo: 0, hi: 5 },
        { key: "morning", label: "오전(6~11시)", lo: 6, hi: 11 },
        { key: "afternoon", label: "오후(12~17시)", lo: 12, hi: 17 },
        { key: "evening", label: "저녁(18~23시)", lo: 18, hi: 23 },
    ];
    if (total === 0) {
        return bands.map((b) => ({ key: b.key, label: b.label, percent: 0 }));
    }
    const raw = bands.map((b) => {
        let c = 0;
        for (let h = b.lo; h <= b.hi; h += 1)
            c += hourly[h] ?? 0;
        return { key: b.key, label: b.label, count: c };
    });
    const sum = raw.reduce((a, x) => a + x.count, 0) || 1;
    let rounded = raw.map((x) => ({
        key: x.key,
        label: x.label,
        percent: round((x.count / sum) * 100, 1),
    }));
    const drift = 100 - rounded.reduce((a, x) => a + x.percent, 0);
    if (Math.abs(drift) >= 0.05 && rounded.length > 0) {
        const idx = rounded.reduce((best, x, i, arr) => (x.percent >= arr[best].percent ? i : best), 0);
        rounded = rounded.map((x, i) => i === idx ? { ...x, percent: round(x.percent + drift, 1) } : x);
    }
    return rounded;
}
function computeRhythmScore(input) {
    const g = input.gini ?? 0.45;
    const streakN = Math.min(1, input.longestStreak / 28);
    const densityN = input.density != null ? Math.min(1, input.density / 40) : 0.25;
    const score = 48 * (1 - Math.min(0.95, g)) + 32 * streakN + 20 * densityN;
    return Math.max(0, Math.min(100, Math.round(score)));
}
function buildHighlights(input) {
    const out = [];
    if (input.topAlias && input.topShare !== null && input.total > 0) {
        out.push(`가장 말이 많았던 분은 **${input.topAlias}** (전체의 **${input.topShare}%**).`);
    }
    if (input.busiestWeekdayLabel) {
        out.push(`요일별로는 **${input.busiestWeekdayLabel}**에 활동이 가장 활발했어요.`);
    }
    if (input.peakHour !== null) {
        out.push(`시간대는 **${input.peakHour}시**대에 메시지가 가장 몰렸습니다.`);
    }
    if (input.medianReplyGapMinutes !== null) {
        out.push(`연속 메시지 사이 간격의 중앙값은 약 **${input.medianReplyGapMinutes}분**이에요.`);
    }
    if (input.nightSharePercent > 0) {
        out.push(`심야(23~05시) 메시지 비중은 **${input.nightSharePercent}%**입니다.`);
    }
    if (input.longestStreak > 1) {
        out.push(`하루도 빠짐없이 이어진 최장 **${input.longestStreak}일** 연속 활동 기록이 있어요.`);
    }
    if (input.emojiMessages > 0) {
        out.push(`이모지·스티커 느낌의 메시지는 **${input.emojiMessages}**건 정도 감지됐어요.`);
    }
    if (input.messagesWithAttachments > 0) {
        out.push(`사진·파일·동영상 등 첨부가 들어간 메시지는 **${input.messagesWithAttachments}**건입니다.`);
    }
    if (input.total > 0 && input.weekendSharePercent > 0) {
        out.push(`주말(토·일) 메시지 비중은 **${input.weekendSharePercent}%**예요.`);
    }
    if (input.participantGini !== null && input.participantGini >= 0.35) {
        out.push(`참여도는 소수에게 조금 몰린 편이에요(Gini **${input.participantGini}** 근처).`);
    }
    if (input.replyGapP90Minutes !== null && input.replyGapP90Minutes >= 30) {
        out.push(`가끔 긴 침묵도 있어요 — 응답 간격 **상위 10%**가 약 **${input.replyGapP90Minutes}분** 이상입니다.`);
    }
    if (input.maxSilenceBetweenActiveDays !== null && input.maxSilenceBetweenActiveDays >= 7) {
        out.push(`활동일 사이 최대 **${input.maxSilenceBetweenActiveDays}일** 동안은 메시지가 끊긴 구간이 있었어요.`);
    }
    if (input.rhythmScore >= 65) {
        out.push(`종합 **리듬 점수**는 **${input.rhythmScore}/100** — 꾸준하고 균형 잡힌 페이스에 가깝습니다.`);
    }
    if (input.burstGapUnder1mPercent !== null && input.burstGapUnder1mPercent >= 40) {
        out.push(`응답 간격의 **${input.burstGapUnder1mPercent}%**가 1분 이내로, 실시간 대화 톤이 강해요.`);
    }
    if (input.monologueMessagesPercent >= 25) {
        out.push(`같은 사람 **3연속 이상** 메시지가 전체의 **${input.monologueMessagesPercent}%** — 긴 설명·정리 구간이 잦을 수 있어요.`);
    }
    return out.slice(0, 12);
}
//# sourceMappingURL=analysis.js.map