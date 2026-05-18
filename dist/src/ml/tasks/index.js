import { preloadSentimentPipeline } from "./sentiment.js";
import { preloadSemanticPipeline } from "./embedding.js";
import { preloadToxicityPipeline } from "../../toxicity-analyze.js";
/** transformers 파이프라인 병렬 워밍업(실패는 stderr 만) */
export async function preloadUtteranceMlTasks(opts) {
    const warmups = [];
    if (opts.sentiment) {
        warmups.push(preloadSentimentPipeline(opts.buildOptions, opts.messageCount).catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] 감정 워밍업 건너뜀: ${msg}\n`);
        }));
    }
    if (opts.semantic) {
        warmups.push(preloadSemanticPipeline(opts.buildOptions, opts.messageCount).catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] 시맨틱 워밍업 건너뜀: ${msg}\n`);
        }));
    }
    if (opts.toxicity) {
        warmups.push(preloadToxicityPipeline().catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] 독성 워밍업 건너뜀: ${msg}\n`);
        }));
    }
    await Promise.all(warmups);
}
//# sourceMappingURL=index.js.map