import { classTfidfTopTerms } from "./ctfidf.js";
import { discourseRatio, isDiscourseTerm } from "./discourse-lexicon.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import { isGenericTopicLead } from "./topic-generic.js";
import { filterMeaningfulTopicTerms } from "./topic-stopwords.js";
import { normalizeTopicTerms } from "./topic-normalize.js";
const MIN_THEME_MESSAGE_PERCENT_DEFAULT = 1.5;
const MIN_THEME_MESSAGE_PERCENT_LARGE = 0.8;
const MAX_THEME_DISCOURSE_RATIO = 0.5;
const LARGE_CORPUS_MESSAGES = 50_000;
const VERY_LARGE_CORPUS_MESSAGES = 90_000;
const MIN_EDGE_PMI = 0.35;
const MAX_GRAPH_NODES = 140;
/** graph 레인 상한 — 최종 slice는 topic-merge */
export const MAX_GRAPH_TOPICS = 12;
const MIN_MONTH_MESSAGES = 40;
const COOC_WINDOW = 4;
function edgeKey(a, b) {
    return a < b ? `${a}\t${b}` : `${b}\t${a}`;
}
function monthLabel(ym) {
    const [y, m] = ym.split("-");
    if (!y || !m)
        return ym;
    return `${y}년 ${Number(m)}월`;
}
/** 스트리밍 주제 맵: 공기 그래프 군집 + 월별 c-TF-IDF */
export class TopicMapAccumulator {
    cooc = new Map();
    tokenDocFreq = new Map();
    monthlyTf = new Map();
    monthlyMessages = new Map();
    messages = 0;
    addMessage(tokens, monthKey) {
        const filtered = tokens.filter((t) => t.length >= 2 && !isNoiseKeyword(t));
        if (filtered.length === 0)
            return;
        this.messages += 1;
        const seen = new Set();
        for (const t of filtered) {
            if (!seen.has(t)) {
                this.tokenDocFreq.set(t, (this.tokenDocFreq.get(t) ?? 0) + 1);
                seen.add(t);
            }
        }
        let monthMap = this.monthlyTf.get(monthKey);
        if (!monthMap) {
            monthMap = new Map();
            this.monthlyTf.set(monthKey, monthMap);
        }
        this.monthlyMessages.set(monthKey, (this.monthlyMessages.get(monthKey) ?? 0) + 1);
        for (const t of filtered) {
            monthMap.set(t, (monthMap.get(t) ?? 0) + 1);
        }
        const uniq = [...seen];
        for (let i = 0; i < uniq.length; i += 1) {
            for (let j = i + 1; j < uniq.length && j < i + COOC_WINDOW; j += 1) {
                const k = edgeKey(uniq[i], uniq[j]);
                this.cooc.set(k, (this.cooc.get(k) ?? 0) + 1);
            }
        }
    }
    buildTopics(totalMessages, stopwords) {
        if (this.messages < 30)
            return [];
        const themes = this.buildCooccurrenceThemes(totalMessages, stopwords);
        const periods = this.buildMonthlyPeriods(totalMessages, stopwords);
        const minThemePct = totalMessages >= LARGE_CORPUS_MESSAGES
            ? MIN_THEME_MESSAGE_PERCENT_LARGE
            : MIN_THEME_MESSAGE_PERCENT_DEFAULT;
        const merged = refineTopics([...themes, ...periods].sort((a, b) => b.messagePercent - a.messagePercent || b.terms.length - a.terms.length), minThemePct);
        return merged.slice(0, MAX_GRAPH_TOPICS);
    }
    /** 키워드 시드용 공기 이웃 */
    getCooccurrenceNeighbors(label, limit = 3) {
        const seeds = label
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2);
        const scores = new Map();
        for (const term of seeds) {
            for (const [key, weight] of this.cooc) {
                const [a, b] = key.split("\t");
                if (!a || !b)
                    continue;
                if (a === term && b !== term)
                    scores.set(b, (scores.get(b) ?? 0) + weight);
                if (b === term && a !== term)
                    scores.set(a, (scores.get(a) ?? 0) + weight);
            }
        }
        return [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([t]) => t);
    }
    buildCooccurrenceThemes(totalMessages, stopwords) {
        const minThemePct = totalMessages >= LARGE_CORPUS_MESSAGES
            ? MIN_THEME_MESSAGE_PERCENT_LARGE
            : MIN_THEME_MESSAGE_PERCENT_DEFAULT;
        const maxCommunities = totalMessages >= VERY_LARGE_CORPUS_MESSAGES ? 10 : 12;
        const nodes = [...this.tokenDocFreq.entries()]
            .filter(([t]) => !stopwords.has(t) && !isNoiseKeyword(t))
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_GRAPH_NODES)
            .map(([t]) => t);
        if (nodes.length < 4)
            return [];
        const nodeSet = new Set(nodes);
        const neighbors = new Map();
        for (const term of nodes)
            neighbors.set(term, new Map());
        const minEdgeWeight = totalMessages >= LARGE_CORPUS_MESSAGES ? 4 : 2;
        for (const [key, weight] of this.cooc) {
            const [a, b] = key.split("\t");
            if (!a || !b || !nodeSet.has(a) || !nodeSet.has(b))
                continue;
            if (weight < minEdgeWeight)
                continue;
            const dfA = this.tokenDocFreq.get(a) ?? 0;
            const dfB = this.tokenDocFreq.get(b) ?? 0;
            if (dfA < 2 || dfB < 2)
                continue;
            const pmi = Math.log((weight * Math.max(this.messages, 1)) / (dfA * dfB));
            const minPmi = totalMessages >= LARGE_CORPUS_MESSAGES ? MIN_EDGE_PMI : 0;
            if (pmi < minPmi)
                continue;
            neighbors.get(a).set(b, weight);
            neighbors.get(b).set(a, weight);
        }
        const assigned = new Set();
        const communities = [];
        for (const seed of nodes) {
            if (assigned.has(seed))
                continue;
            const community = [];
            const queue = [seed];
            assigned.add(seed);
            while (queue.length > 0) {
                const cur = queue.shift();
                community.push(cur);
                const adj = [...(neighbors.get(cur)?.entries() ?? [])].sort((a, b) => b[1] - a[1]);
                for (const [next, w] of adj.slice(0, 12)) {
                    if (assigned.has(next) || w < minEdgeWeight)
                        continue;
                    assigned.add(next);
                    queue.push(next);
                }
                if (community.length >= 18)
                    break;
            }
            if (community.length >= 2)
                communities.push(community);
            if (communities.length >= maxCommunities)
                break;
        }
        const classTf = new Map();
        communities.forEach((terms, i) => {
            const bag = new Map();
            for (const t of terms) {
                bag.set(t, this.tokenDocFreq.get(t) ?? 1);
            }
            classTf.set(`theme-${i}`, bag);
        });
        const ranked = classTfidfTopTerms(classTf, 6);
        const topics = [];
        for (const [classId, termScores] of ranked) {
            const terms = filterMeaningfulTopicTerms(termScores.map((x) => x.term), stopwords);
            if (terms.length < 2)
                continue;
            if (discourseRatio(terms) > MAX_THEME_DISCOURSE_RATIO)
                continue;
            const idx = Number(classId.replace("theme-", ""));
            const community = communities[idx] ?? terms;
            let maxHits = 0;
            for (const t of community)
                maxHits = Math.max(maxHits, this.tokenDocFreq.get(t) ?? 0);
            const cappedHits = Math.min(maxHits, this.messages, totalMessages);
            const messagePercent = Math.round(Math.min(100, (cappedHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
            if (messagePercent < minThemePct)
                continue;
            const lead = pickThemeLead(terms);
            const sub = terms.find((t) => t !== lead && !isDiscourseTerm(t));
            topics.push({
                id: classId,
                kind: "theme",
                title: sub && sub !== lead ? `${lead} · ${sub}` : lead,
                terms: terms.slice(0, 8),
                messagePercent,
            });
        }
        return topics.sort((a, b) => b.messagePercent - a.messagePercent);
    }
    buildMonthlyPeriods(totalMessages, stopwords) {
        const eligible = [...this.monthlyMessages.entries()]
            .filter(([, c]) => c >= MIN_MONTH_MESSAGES)
            .sort((a, b) => b[1] - a[1]);
        if (eligible.length === 0)
            return [];
        const classTf = new Map();
        for (const [ym] of eligible) {
            const raw = this.monthlyTf.get(ym);
            if (!raw)
                continue;
            const bag = new Map();
            for (const [term, c] of raw) {
                if (stopwords.has(term) || isNoiseKeyword(term))
                    continue;
                bag.set(term, c);
            }
            if (bag.size > 0)
                classTf.set(ym, bag);
        }
        const ranked = classTfidfTopTerms(classTf, 6);
        const topics = [];
        for (const [ym, termScores] of ranked) {
            const terms = filterMeaningfulTopicTerms(termScores.map((x) => x.term), stopwords);
            if (terms.length < 2)
                continue;
            const monthMsgs = this.monthlyMessages.get(ym) ?? 0;
            const messagePercent = Math.round((monthMsgs / Math.max(totalMessages, 1)) * 1000) / 10;
            topics.push({
                id: `month-${ym}`,
                kind: "period",
                title: monthLabel(ym),
                terms: terms.slice(0, 8),
                messagePercent,
                periodLabel: monthLabel(ym),
            });
        }
        return topics.slice(0, 4);
    }
}
function refineTopics(topics, minThemePct) {
    const out = [];
    for (const t of topics) {
        const terms = t.terms;
        if (terms.length < 2)
            continue;
        if (t.kind === "theme") {
            if (t.messagePercent < minThemePct)
                continue;
            const lead = pickThemeLead(terms);
            if (isDiscourseTerm(lead) && discourseRatio(terms) >= 0.75)
                continue;
            if (out.some((o) => o.kind === "theme" && normalizedTermJaccard(terms, o.terms) > 0.55))
                continue;
        }
        const lead = t.kind === "theme" ? pickThemeLead(terms) : terms[0];
        const sub = t.kind === "theme" ? terms.find((term) => term !== lead && !isDiscourseTerm(term)) : terms[1];
        const title = t.kind === "period"
            ? (t.periodLabel ?? t.title)
            : sub && sub !== lead
                ? `${lead} · ${sub}`
                : lead;
        out.push({ ...t, title, terms: terms.slice(0, 8) });
    }
    return mergeSimilarTopics(out);
}
function mergeSimilarTopics(topics) {
    const merged = [];
    for (const t of topics) {
        const hit = merged.find((m) => m.kind === t.kind &&
            t.kind === "period" &&
            m.periodLabel === t.periodLabel &&
            jaccard(m.terms, t.terms) > 0.6);
        if (hit) {
            hit.messagePercent = Math.max(hit.messagePercent, t.messagePercent);
            const terms = [...new Set([...hit.terms, ...t.terms])].slice(0, 8);
            hit.terms = terms;
            hit.title = hit.periodLabel ?? hit.title;
        }
        else {
            merged.push({ ...t });
        }
    }
    return merged;
}
function pickThemeLead(terms) {
    const specific = terms.find((t) => !isDiscourseTerm(t) && !isGenericTopicLead(t));
    if (specific)
        return specific;
    const clean = terms.find((t) => !isDiscourseTerm(t));
    return clean ?? terms[0] ?? "주제";
}
function normalizedTermJaccard(a, b) {
    return jaccard(normalizeTopicTerms(a), normalizeTopicTerms(b));
}
function jaccard(a, b) {
    const setB = b instanceof Set ? b : new Set(b);
    if (a.length === 0)
        return 0;
    let inter = 0;
    for (const x of a)
        if (setB.has(x))
            inter += 1;
    const union = new Set([...a, ...setB]).size;
    return union > 0 ? inter / union : 0;
}
//# sourceMappingURL=topic-map.js.map