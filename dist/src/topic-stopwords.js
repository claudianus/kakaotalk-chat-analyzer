import { isDiscourseTerm } from "./discourse-lexicon.js";
import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { isNoiseKeyword } from "./keyword-quality.js";
export function buildTopicStopwords() {
    return buildKeywordStopwords();
}
/** @deprecated use isDiscourseTerm */
export function isTopicDiscourse(term) {
    return isDiscourseTerm(term);
}
export function filterMeaningfulTopicTerms(terms, stopwords) {
    return terms.filter((t) => !stopwords.has(t) && !isNoiseKeyword(t) && !isDiscourseTerm(t));
}
//# sourceMappingURL=topic-stopwords.js.map