/** BERTopic-style class-based TF-IDF (Maarten Grootendorst c-TF-IDF) */
export declare function classTfidfTopTerms(classTermFreq: Map<string, Map<string, number>>, topPerClass: number): Map<string, Array<{
    term: string;
    score: number;
}>>;
