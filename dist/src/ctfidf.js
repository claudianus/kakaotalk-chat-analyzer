/** BERTopic-style class-based TF-IDF (Maarten Grootendorst c-TF-IDF) */
export function classTfidfTopTerms(classTermFreq, topPerClass) {
    const classSizes = new Map();
    let totalTerms = 0;
    let classCount = 0;
    for (const [classId, terms] of classTermFreq) {
        let sum = 0;
        for (const c of terms.values())
            sum += c;
        if (sum <= 0)
            continue;
        classSizes.set(classId, sum);
        totalTerms += sum;
        classCount += 1;
    }
    if (classCount === 0)
        return new Map();
    const avgTermsPerClass = totalTerms / classCount;
    const docFreq = new Map();
    for (const terms of classTermFreq.values()) {
        for (const term of terms.keys()) {
            docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
        }
    }
    const out = new Map();
    for (const [classId, terms] of classTermFreq) {
        const classSum = classSizes.get(classId) ?? 0;
        if (classSum <= 0)
            continue;
        const scored = [];
        for (const [term, tf] of terms) {
            const tfNorm = tf / classSum;
            const df = docFreq.get(term) ?? 1;
            const idf = Math.log(1 + avgTermsPerClass / df);
            scored.push({ term, score: tfNorm * idf });
        }
        scored.sort((a, b) => b.score - a.score || b.term.length - a.term.length);
        out.set(classId, scored.slice(0, topPerClass));
    }
    return out;
}
//# sourceMappingURL=ctfidf.js.map