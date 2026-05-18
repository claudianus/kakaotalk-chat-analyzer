import { ensureCoreMlBundles } from "../../ml-bundle-install.js";
import { ensureToxicityBundle } from "../../ml-bundle-cache.js";
import { preloadSentimentPipeline } from "./sentiment.js";
import { preloadSemanticPipeline } from "./embedding.js";
import { preloadToxicityPipeline } from "../../toxicity-analyze.js";
import { isBundledToxicityModelReady } from "../../ml-bundled-models.js";
/** transformers 파이프라인 병렬 워밍업(실패는 stderr 만) */
export async function preloadUtteranceMlTasks(opts) {
    if (opts.sentiment || opts.semantic || opts.toxicity) {
        await ensureCoreMlBundles().catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] ML 번들 준비 건너뜀: ${msg}\n`);
        });
    }
    if (opts.toxicity && !process.env.KCA_TOXICITY_MODEL?.trim() && !isBundledToxicityModelReady()) {
        await ensureToxicityBundle().catch((error) => {
            const msg = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[kca] 독성 번들 준비 건너뜀: ${msg}\n`);
        });
    }
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
    for (const task of warmups)
        await task;
}
//# sourceMappingURL=index.js.map