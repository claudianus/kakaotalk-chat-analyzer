import { getKiwiRuntime, kiwiKeywordTokens } from "./kiwi-runtime.js";
import { canonicalKeywordToken } from "./keyword-canonical.js";
import { normalizeKoreanText } from "./korean-normalize.js";
const MAX_TOKEN_LEN = 32;
const HANGUL_GLUE_RE = /[가-힣]{6,}/;
const KIWI_MORPH_MAX_CHARS = 768;
const TRAILING_ENDING_RE = /(?:했(?:어|음|네|지)?|했|하는|하다|해서|이고|이었|었는|는데|지만|으로|에서|에게|부터|까지|처럼|보다|마다|라서|라고|습니다|세요|해요|함|임|음|네|지|아|어|야|요)$/u;
function normalizeToken(token) {
    const t = /^[A-Za-z0-9_+-]+$/.test(token) ? token.toLowerCase() : token.trim();
    return canonicalKeywordToken(t);
}
function spaceTokens(doc) {
    const out = [];
    for (const raw of doc.split(/\s+/)) {
        if (!raw)
            continue;
        const t = normalizeToken(raw);
        if (t.length < 2 || t.length > MAX_TOKEN_LEN)
            continue;
        if (!/[가-힣A-Za-z]/.test(t))
            continue;
        out.push(t);
    }
    return out;
}
function heuristicExtra(token) {
    const extras = [];
    if (HANGUL_GLUE_RE.test(token)) {
        const stem = token.replace(TRAILING_ENDING_RE, "");
        if (stem.length >= 2 && stem.length < token.length)
            extras.push(canonicalKeywordToken(stem));
    }
    return extras;
}
function mergeTokens(...lists) {
    const seen = new Set();
    const out = [];
    for (const list of lists) {
        for (const t of list) {
            if (!t || seen.has(t))
                continue;
            seen.add(t);
            out.push(t);
        }
    }
    return out;
}
/** 공백·접미사 휴리스틱만 (비교·KCA_NO_KIWI용) */
export function tokenizeHeuristicOnly(raw) {
    const doc = normalizeKoreanText(raw, { keepEnglish: true, keepNumbers: true });
    if (!doc)
        return [];
    const out = [];
    const seen = new Set();
    const push = (t) => {
        if (seen.has(t))
            return;
        seen.add(t);
        out.push(t);
    };
    for (const t of spaceTokens(doc)) {
        push(t);
        for (const extra of heuristicExtra(t))
            push(extra);
    }
    return out;
}
function shouldRunKiwiMorph(doc) {
    return /[가-힣]/.test(doc) && doc.length >= 3;
}
/** 본문 키워드: 공백 어절 + (한글 있으면) Kiwi 형태소 병합 */
export function tokenizeForKeywords(raw) {
    const heur = tokenizeHeuristicOnly(raw);
    if (process.env.KCA_NO_KIWI === "1")
        return heur;
    const doc = normalizeKoreanText(raw, { keepEnglish: true, keepNumbers: true });
    if (!doc)
        return heur;
    const kiwi = getKiwiRuntime();
    if (!kiwi || !shouldRunKiwiMorph(doc))
        return heur;
    const slice = doc.length > KIWI_MORPH_MAX_CHARS ? doc.slice(0, KIWI_MORPH_MAX_CHARS) : doc;
    const fromKiwi = kiwiKeywordTokens(slice);
    return mergeTokens(fromKiwi, heur);
}
//# sourceMappingURL=keyword-tokenize.js.map