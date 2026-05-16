/**
 * KR-WordRank (Kim et al. 2014) 스트리밍 포팅
 * @see https://github.com/lovit/KR-WordRank
 * @see https://lovit.github.io/nlp/2018/04/16/krwordrank/
 */
import { normalizeKoreanText } from "./korean-normalize.js";
const DEFAULT_MIN_COUNT = 4;
const DEFAULT_MAX_LENGTH = 10;
const MAX_VOCAB = 48_000;
const MAX_EDGE_KEYS = 280_000;
function tokenKey(t) {
    return `${t[1]}:${t[0]}`;
}
function parseTokenKey(key) {
    const i = key.indexOf(":");
    return [key.slice(i + 1), key.charAt(0)];
}
/** 메시지 스트림으로 학습 → HITS → L-부분 키워드 */
export class KrWordRankStream {
    minCount;
    maxLength;
    beta;
    maxIter;
    numRset;
    converge;
    counter = new Map();
    edgeCounts = new Map();
    /** 공백 단위 어절이 포함된 메시지 수 */
    wordDocFreq = new Map();
    documents = 0;
    constructor(options = {}) {
        this.minCount = options.minCount ?? DEFAULT_MIN_COUNT;
        this.maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
        this.beta = options.beta ?? 0.85;
        this.maxIter = options.maxIter ?? 12;
        this.numRset = options.numRset ?? 280;
        this.converge = options.converge ?? 0.001;
    }
    addDocument(raw) {
        const doc = normalizeKoreanText(raw, { keepEnglish: true, keepNumbers: true });
        if (!doc)
            return;
        this.documents += 1;
        const tokens = doc.split(/\s+/).filter(Boolean);
        if (tokens.length === 0)
            return;
        const seenWord = new Set();
        for (const token of tokens) {
            if (token.length >= 2 && !seenWord.has(token)) {
                seenWord.add(token);
                this.wordDocFreq.set(token, (this.wordDocFreq.get(token) ?? 0) + 1);
            }
            this.scanToken(token);
        }
        const links = [];
        for (const token of tokens) {
            links.push(...intraLinks(token, this.maxLength));
        }
        if (tokens.length > 1) {
            const padded = [tokens[tokens.length - 1], ...tokens, tokens[0]];
            links.push(...interLinks(padded, this.maxLength));
        }
        for (const [a, b] of links) {
            this.bumpEdge(a, b);
        }
    }
    extractKeywords(options = {}) {
        const vocab = this.buildVocabulary();
        if (vocab.index2token.length < 2)
            return new Map();
        const graph = this.buildGraph(vocab);
        const rank = runHits(graph, {
            beta: this.beta,
            maxIter: this.maxIter,
            converge: this.converge,
            nodeCount: vocab.index2token.length,
        });
        const lset = new Map();
        const rset = new Map();
        for (const [idx, score] of rank) {
            const tok = vocab.index2token[idx];
            if (!tok)
                continue;
            const [word, pos] = tok;
            if (pos === "L")
                lset.set(word, score);
            else
                rset.set(word, score);
        }
        let rsetUse = rset;
        if (this.numRset > 0 && rset.size > this.numRset) {
            rsetUse = new Map([...rset.entries()].sort((a, b) => b[1] - a[1]).slice(0, this.numRset));
        }
        let keywords = selectKeywords(lset, rsetUse);
        keywords = filterCompounds(keywords);
        keywords = filterSubtokens(keywords);
        const stop = options.stopwords;
        const limit = options.limit ?? 100;
        const out = new Map();
        for (const [word, score] of [...keywords.entries()].sort((a, b) => b[1] - a[1])) {
            if (stop?.has(word))
                continue;
            if (word.length < 2)
                continue;
            out.set(word, score);
            if (out.size >= limit)
                break;
        }
        return out;
    }
    extractKeywordItems(options = {}) {
        const scores = this.extractKeywords(options);
        return [...scores.entries()]
            .map(([label, score]) => ({
            label,
            score,
            messageHits: this.wordDocFreq.get(label) ?? 0,
        }))
            .sort((a, b) => b.score - a.score || b.messageHits - a.messageHits);
    }
    scanToken(token) {
        const len = token.length;
        this.bumpCounter([token, "L"]);
        for (let e = 1; e < Math.min(len, this.maxLength); e += 1) {
            if (len - e > this.maxLength)
                continue;
            this.bumpCounter([token.slice(0, e), "L"]);
            this.bumpCounter([token.slice(e), "R"]);
        }
    }
    bumpCounter(token) {
        const k = tokenKey(token);
        this.counter.set(k, (this.counter.get(k) ?? 0) + 1);
        if (this.counter.size > MAX_VOCAB * 3)
            this.pruneCounter();
    }
    pruneCounter() {
        const kept = [...this.counter.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_VOCAB);
        this.counter.clear();
        for (const [k, v] of kept)
            this.counter.set(k, v);
    }
    bumpEdge(a, b) {
        if (this.edgeCounts.size > MAX_EDGE_KEYS)
            return;
        const k = `${tokenKey(a)}>>${tokenKey(b)}`;
        this.edgeCounts.set(k, (this.edgeCounts.get(k) ?? 0) + 1);
    }
    buildVocabulary() {
        let entries = [...this.counter.entries()].filter(([, c]) => c >= this.minCount);
        entries = pruneDominatedSubwords(entries);
        entries.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
        entries = entries.slice(0, MAX_VOCAB);
        const token2idx = new Map();
        const index2token = [];
        for (const [k] of entries) {
            token2idx.set(k, index2token.length);
            index2token.push(parseTokenKey(k));
        }
        return { token2idx, index2token };
    }
    buildGraph(vocab) {
        const raw = new Map();
        for (const [key, weight] of this.edgeCounts) {
            const sep = key.indexOf(">>");
            if (sep < 0)
                continue;
            const a = vocab.token2idx.get(key.slice(0, sep));
            const b = vocab.token2idx.get(key.slice(sep + 2));
            if (a === undefined || b === undefined)
                continue;
            let row = raw.get(a);
            if (!row) {
                row = new Map();
                raw.set(a, row);
            }
            row.set(b, (row.get(b) ?? 0) + weight);
            let rowB = raw.get(b);
            if (!rowB) {
                rowB = new Map();
                raw.set(b, rowB);
            }
            rowB.set(a, (rowB.get(a) ?? 0) + weight);
        }
        const graph = new Map();
        for (const [fromNode, toDict] of raw) {
            const sum = [...toDict.values()].reduce((a, c) => a + c, 0);
            if (sum <= 0)
                continue;
            for (const [toNode, w] of toDict) {
                let col = graph.get(toNode);
                if (!col) {
                    col = new Map();
                    graph.set(toNode, col);
                }
                col.set(fromNode, (col.get(fromNode) ?? 0) + w / sum);
            }
        }
        return graph;
    }
}
function intraLinks(token, maxLength) {
    const out = [];
    const len = token.length;
    for (let e = 1; e < Math.min(len, 10); e += 1) {
        if (len - e > maxLength)
            continue;
        out.push([[token.slice(0, e), "L"], [token.slice(e), "R"]]);
    }
    return out;
}
function interLinks(tokens, maxLength) {
    const out = [];
    for (let i = 1; i < tokens.length - 1; i += 1) {
        const left = tokens[i - 1];
        const curr = tokens[i];
        const right = tokens[i + 1];
        for (let b = 1; b < Math.min(10, left.length); b += 1) {
            out.push([[left.slice(-b), "R"], [curr, "L"]]);
        }
        for (let e = 1; e < Math.min(10, right.length); e += 1) {
            out.push([[curr, "L"], [right.slice(0, e), "L"]]);
        }
    }
    return out;
}
function pruneDominatedSubwords(entries) {
    const sorted = [...entries].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    const kept = [];
    for (const [key, freq] of sorted) {
        const dominated = kept.some(([k, f]) => {
            if (f !== freq)
                return false;
            const posK = k.charAt(0);
            const posKey = key.charAt(0);
            if (posK !== posKey)
                return false;
            const s = k.slice(2);
            const t = key.slice(2);
            return s.length > t.length && s.includes(t);
        });
        if (!dominated)
            kept.push([key, freq]);
    }
    return kept;
}
function runHits(graph, opts) {
    const { beta, maxIter, converge, nodeCount } = opts;
    const dw = 100 / nodeCount;
    const rank = new Map();
    for (const node of graph.keys())
        rank.set(node, dw);
    const sumWeight = 100;
    for (let iter = 1; iter <= maxIter; iter += 1) {
        const next = new Map();
        let diff = 0;
        for (const [toNode, fromDict] of graph) {
            let s = 0;
            for (const [fromNode, w] of fromDict) {
                s += w * (rank.get(fromNode) ?? dw);
            }
            const updated = beta * s + (1 - beta) * dw;
            next.set(toNode, updated);
            diff += Math.abs(updated - (rank.get(toNode) ?? 0));
        }
        for (const [n, v] of next)
            rank.set(n, v);
        if (diff < sumWeight * converge)
            break;
    }
    return rank;
}
function selectKeywords(lset, rset) {
    const keywords = new Map();
    for (const [word, r] of [...lset.entries()].sort((a, b) => b[1] - a[1])) {
        if (word.length === 1)
            continue;
        let compound = false;
        for (let e = 2; e < word.length; e += 1) {
            if (keywords.has(word.slice(0, e)) && rset.has(word.slice(0, e))) {
                compound = true;
                break;
            }
        }
        if (!compound)
            keywords.set(word, r);
    }
    return keywords;
}
function filterCompounds(keywords) {
    const out = new Map();
    for (const [word, r] of [...keywords.entries()].sort((a, b) => b[1] - a[1])) {
        const len = word.length;
        if (len <= 2) {
            out.set(word, r);
            continue;
        }
        if (len === 3 && out.has(word.slice(0, 2)))
            continue;
        let compound = false;
        for (let e = 2; e < len; e += 1) {
            if (keywords.has(word.slice(0, e)) && keywords.has(word.slice(e))) {
                compound = true;
                break;
            }
        }
        if (!compound)
            out.set(word, r);
    }
    return out;
}
function filterSubtokens(keywords) {
    const subtokens = new Set();
    const out = new Map();
    for (const [word, r] of [...keywords.entries()].sort((a, b) => b[1] - a[1])) {
        const subs = new Set();
        for (let e = 2; e <= word.length; e += 1)
            subs.add(word.slice(0, e));
        let isSub = false;
        for (const sub of subs) {
            if (subtokens.has(sub)) {
                isSub = true;
                break;
            }
        }
        if (!isSub) {
            out.set(word, r);
            for (const sub of subs)
                subtokens.add(sub);
        }
    }
    return out;
}
/** 메시지 수에 따른 min_count (소규모 방 완화) */
export function adaptiveMinCount(messageCount) {
    if (messageCount < 200)
        return 2;
    if (messageCount < 2_000)
        return 3;
    if (messageCount < 20_000)
        return 4;
    return 5;
}
//# sourceMappingURL=kr-wordrank-stream.js.map