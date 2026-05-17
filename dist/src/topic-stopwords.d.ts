export declare function buildTopicStopwords(): Set<string>;
/** @deprecated use isDiscourseTerm */
export declare function isTopicDiscourse(term: string): boolean;
export declare function filterMeaningfulTopicTerms(terms: string[], stopwords: ReadonlySet<string>): string[];
