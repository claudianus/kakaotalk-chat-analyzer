import { extractSemanticKeywords } from "./semantic-keywords.js";
import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { getAnalysisProfileSettings } from "./analysis-profile.js";
import { logReportProgress } from "./report-progress.js";
import { analyzeSentimentFromSamples, } from "./sentiment-analyze.js";
import { analyzeToxicityFromSamples } from "./toxicity-analyze.js";
import { preloadUtteranceMlTasks } from "./ml/tasks/index.js";
/** Kiwi·키워드 패스와 병렬 — sentiment·semantic·toxicity 파이프라인 워밍업 */
export async function preloadUtteranceMl(opts) {
    await preloadUtteranceMlTasks({
        sentiment: opts.useSentiment,
        semantic: opts.useSemantic,
        toxicity: opts.useToxicity,
        buildOptions: opts.buildOptions,
        messageCount: opts.messageCount,
    });
}
/** 동일 subsample cap 으로 drain 1회 → 감정·독성, 시맨틱은 별도 리저보어 */
export async function runUtteranceMlPass(agg, opts) {
    let usedSentiment = false;
    let usedToxicity = false;
    let usedSemantic = false;
    const corpusMessages = agg.messageCount();
    const sentimentSamples = opts.useSentiment || opts.useToxicity ? agg.drainSentimentSamples() : [];
    if (sentimentSamples.length >= 48) {
        const aliasMap = agg.senderAliasMap();
        if (opts.useToxicity) {
            try {
                const tox = await analyzeToxicityFromSamples(sentimentSamples, corpusMessages);
                if (tox) {
                    agg.applyToxicityStats(tox);
                    usedToxicity = true;
                }
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                process.stderr.write(`[kca] 독성 분석 건너뜀: ${msg}\n`);
            }
        }
        if (opts.useSentiment) {
            if (opts.showProgress)
                logReportProgress({ phase: "감정 분석", current: 0 });
            try {
                const stats = await analyzeSentimentFromSamples(sentimentSamples, corpusMessages, aliasMap, opts.showProgress
                    ? (current, total) => logReportProgress({ phase: "감정 분석", current, total })
                    : undefined, opts.buildOptions);
                if (stats) {
                    agg.applySentimentStats(stats);
                    usedSentiment = true;
                }
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                process.stderr.write(`[kca] 감정 분석 건너뜀: ${msg}\n`);
            }
        }
    }
    if (opts.useSemantic) {
        const samples = agg.drainSemanticSamples(opts.buildOptions);
        if (samples.length >= 48) {
            const profileSettings = getAnalysisProfileSettings(opts.buildOptions, corpusMessages);
            if (opts.showProgress)
                logReportProgress({ phase: "시맨틱 키워드", current: 0 });
            try {
                const items = await extractSemanticKeywords(samples, {
                    stopwords: buildKeywordStopwords(),
                    corpusMessages,
                    buildOptions: opts.buildOptions,
                    minClusterCoherence: profileSettings.semanticClusterMinCoherence,
                    onProgress: opts.showProgress
                        ? (current, total) => logReportProgress({ phase: "시맨틱 키워드", current, total })
                        : undefined,
                });
                if (items.length > 0) {
                    agg.applySemanticKeywordBoost(items);
                    usedSemantic = true;
                }
            }
            catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                process.stderr.write(`[kca] 시맨틱 키워드 건너뜀: ${msg}\n`);
            }
        }
    }
    return { usedSentiment, usedSemantic, usedToxicity };
}
//# sourceMappingURL=utterance-features.js.map