import { isDiscourseTerm } from "./discourse-lexicon.js";
import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { isNoiseKeyword } from "./keyword-quality.js";

export function buildTopicStopwords(): Set<string> {
  return buildKeywordStopwords();
}

/** @deprecated use isDiscourseTerm */
export function isTopicDiscourse(term: string): boolean {
  return isDiscourseTerm(term);
}

export function filterMeaningfulTopicTerms(
  terms: string[],
  stopwords: ReadonlySet<string>,
): string[] {
  return terms.filter((t) => !stopwords.has(t) && !isNoiseKeyword(t) && !isDiscourseTerm(t));
}
