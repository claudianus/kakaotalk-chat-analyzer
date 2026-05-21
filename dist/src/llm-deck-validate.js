const KEYWORD_POOL_MAX = 80;
/** LLM 출력의 템플릿 잔여물·오류 메시지·JSON 키 필터링 */
export function isLlmGarbageText(value) {
    const v = value.trim();
    if (v.length < 4)
        return true;
    // JSON 문법 잔여물
    if (/[\]}{]/.test(v))
        return true;
    // 오류/메타 메시지
    if (/this is not correct|please wait|json|schema|format|template/i.test(v))
        return true;
    // 통계 숫자만 나열 (쉼표·공백·%·숫자 외 문자 없음)
    if (/^[\d\s,%\.]+$/.test(v))
        return true;
    // 키워드 없이 구두점·숫자만 있는 경우
    if (!/[\p{L}]/u.test(v))
        return true;
    // JSON 필드명 그대로 출력된 경우 (camelCase 필드명)
    if (/^(?:topicProposals|topicTitles|insightBullets|shopSearchSummary|dyadInsight|roomArchetype|relationshipBeats|episodeCards|eraLabels|insideJokes|characterCards|dayMicroStories|shareLine|hashtags|counterfactuals|paragraphs|moments)$/i.test(v))
        return true;
    // markdown fence나 json 키워드로 시작/끝
    if (/^```|^\{|\}$|^\[|\]$/.test(v))
        return true;
    return false;
}
function keywordPool(data) {
    const pool = new Set();
    for (const k of data.keywords.slice(0, KEYWORD_POOL_MAX)) {
        const label = k.label?.trim();
        if (label)
            pool.add(label);
    }
    for (const h of data.highlights) {
        for (const m of h.match(/[\p{L}\p{N}_#]+/gu) ?? []) {
            if (m.length >= 2)
                pool.add(m);
        }
    }
    return pool;
}
function statTokens(data) {
    const s = new Set();
    const pushNum = (n) => {
        if (n === null || n === undefined || Number.isNaN(n))
            return;
        s.add(String(n));
        s.add(String(Math.round(n)));
        if (!Number.isInteger(n))
            s.add(n.toFixed(1));
    };
    pushNum(data.summary.totalMessages);
    pushNum(data.summary.participants);
    pushNum(data.summary.activeDays);
    pushNum(data.insights.rhythmScore);
    pushNum(data.insights.top3ParticipantSharePercent);
    pushNum(data.insights.weekendSharePercent);
    if (data.summary.peakHour !== null)
        s.add(`${data.summary.peakHour}`);
    return s;
}
function statRefOk(ref, data) {
    const t = ref.trim();
    if (t.length < 2)
        return false;
    const stats = statTokens(data);
    for (const tok of t.match(/\d+(?:\.\d+)?/g) ?? []) {
        const whole = tok.includes(".") ? tok.split(".")[0] : tok;
        if (stats.has(tok) || stats.has(whole))
            return true;
    }
    return data.highlights.some((h) => h.includes(t.slice(0, Math.min(24, t.length))));
}
export function sanitizeLlmDeck(parsed, data) {
    const kw = keywordPool(data);
    const out = {};
    const arch = parsed.roomArchetype;
    if (arch?.name?.trim() && arch.description?.trim()) {
        out.roomArchetype = {
            name: arch.name.trim().slice(0, 40),
            description: arch.description.trim().slice(0, 200),
            traits: (arch.traits ?? []).map((t) => t.trim().slice(0, 32)).filter(Boolean).slice(0, 4),
        };
    }
    const moments = (parsed.moments ?? [])
        .filter((m) => m.headline?.trim() && m.statRef?.trim() && statRefOk(m.statRef, data))
        .slice(0, 5)
        .map((m) => ({
        headline: m.headline.trim().slice(0, 120),
        statRef: m.statRef.trim().slice(0, 80),
    }));
    if (moments.length)
        out.moments = moments;
    const beats = (parsed.relationshipBeats ?? [])
        .filter((b) => b.pair?.trim() && b.beat?.trim())
        .slice(0, 4)
        .map((b) => ({
        pair: b.pair.trim().slice(0, 48),
        beat: b.beat.trim().slice(0, 120),
        role: b.role?.trim().slice(0, 24),
    }));
    if (beats.length)
        out.relationshipBeats = beats;
    const episodes = (parsed.episodeCards ?? [])
        .filter((e) => e.title?.trim())
        .slice(0, 6)
        .map((e) => ({
        period: (e.period ?? "").trim().slice(0, 40),
        title: e.title.trim().slice(0, 48),
        tagline: (e.tagline ?? "").trim().slice(0, 80),
        emoji: (e.emoji ?? "📖").trim().slice(0, 4) || "📖",
    }));
    if (episodes.length)
        out.episodeCards = episodes;
    const eras = (parsed.eraLabels ?? [])
        .filter((e) => e.label?.trim())
        .slice(0, 3)
        .map((e) => ({
        label: e.label.trim().slice(0, 48),
        detail: (e.detail ?? "").trim().slice(0, 120),
    }));
    if (eras.length)
        out.eraLabels = eras;
    const jokes = (parsed.insideJokes ?? [])
        .filter((j) => j.label?.trim())
        .slice(0, 5)
        .map((j) => {
        const evidence = (j.evidenceKeywords ?? [])
            .map((k) => k.trim())
            .filter((k) => k && kw.has(k))
            .slice(0, 4);
        return {
            label: j.label.trim().slice(0, 40),
            whyFunny: (j.whyFunny ?? "").trim().slice(0, 120),
            evidenceKeywords: evidence,
        };
    })
        .filter((j) => j.evidenceKeywords.length > 0 || j.whyFunny.length > 8);
    if (jokes.length)
        out.insideJokes = jokes;
    const chars = (parsed.characterCards ?? [])
        .filter((c) => c.alias?.trim())
        .slice(0, 3)
        .map((c) => ({
        alias: c.alias.trim().slice(0, 32),
        tagline: (c.tagline ?? "").trim().slice(0, 80),
        statHook: (c.statHook ?? "").trim().slice(0, 60),
    }));
    if (chars.length)
        out.characterCards = chars;
    const days = (parsed.dayMicroStories ?? [])
        .filter((d) => d.date?.trim() && d.line?.trim())
        .slice(0, 5)
        .map((d) => ({
        date: d.date.trim().slice(0, 10),
        line: d.line.trim().slice(0, 120),
    }));
    if (days.length)
        out.dayMicroStories = days;
    if (parsed.shareLine?.trim()) {
        out.shareLine = parsed.shareLine.trim().slice(0, 160);
    }
    const tags = (parsed.hashtags ?? []).map((h) => h.trim().replace(/^#/, "")).filter(Boolean).slice(0, 3);
    if (tags.length)
        out.hashtags = tags.map((h) => h.slice(0, 24));
    const cf = (parsed.counterfactuals ?? [])
        .filter((c) => c.text?.trim())
        .slice(0, 2)
        .map((c) => ({ text: c.text.trim().slice(0, 120) }));
    if (cf.length)
        out.counterfactuals = cf;
    return out;
}
//# sourceMappingURL=llm-deck-validate.js.map