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
    const gapsMs = [];
    let prevMs = null;
    let prevSender = null;
    let runSender = null;
    let runLen = 0;
    for (const record of result.records) {
        const alias = aliases.get(record.sender) ?? "???";
        const stat = getParticipantStat(senderStats, alias);
        const messageLength = record.message.length;
        const foundAttachments = getAttachmentMarkers(record.message);
        const foundDomains = getDomains(record.message);
        const ms = partsToUtcMs(record.date);
        if (/\p{Extended_Pictographic}/u.test(record.message)) {
            emojiMessages += 1;
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
        weekdays[weekdayIndex(record.date)] = (weekdays[weekdayIndex(record.date)] ?? 0) + 1;
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
    return out.slice(0, 8);
}
//# sourceMappingURL=analysis.js.map