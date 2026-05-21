import { memoryHeadroomGb, probeMachineProfileSync } from "../../analysis-capability.js";
import { ensureCoreMlBundles } from "../../ml-bundle-install.js";
import { ensureKureBundle, ensureToxicityBundle } from "../../ml-bundle-cache.js";
import { BUNDLED_GRANITE_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID } from "../../ml-bundle-ids.js";
import { semanticEmbeddingModelId } from "../../semantic-policy.js";
import { preloadSentimentPipeline } from "./sentiment.js";
import { preloadSemanticPipeline } from "./embedding.js";
import { preloadToxicityPipeline } from "../../toxicity-analyze.js";
import { isBundledToxicityModelReady } from "../../ml-bundled-models.js";
function logWarmupSkip(label, error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kca] ${label} 워밍업 건너뜀: ${msg}\n`);
}
/** transformers 파이프라인 워밍업 — 저RAM(<12GB headroom)은 순차, 아니면 병렬 */
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
    if (opts.semantic) {
        const semanticModel = semanticEmbeddingModelId(opts.buildOptions, opts.messageCount);
        if (semanticModel === BUNDLED_KURE_MODEL_ID) {
            await ensureKureBundle().catch((error) => {
                const msg = error instanceof Error ? error.message : String(error);
                process.stderr.write(`[kca] KURE 번들 준비 걸너뜀: ${msg}\n`);
            });
        }
        if (semanticModel === BUNDLED_GRANITE_EMBED_MODEL_ID) {
            // Granite 번들은 npm 패키지 또는 data/ml-models에 포함
            // 별도 lazy download 불필요
        }
    }
    const sequential = memoryHeadroomGb(probeMachineProfileSync()) < 12;
    const runners = [];
    if (opts.sentiment) {
        runners.push(() => preloadSentimentPipeline(opts.buildOptions, opts.messageCount).catch((error) => {
            logWarmupSkip("감정", error);
        }));
    }
    if (opts.semantic) {
        runners.push(() => preloadSemanticPipeline(opts.buildOptions, opts.messageCount).catch((error) => {
            logWarmupSkip("시맨틱", error);
        }));
    }
    if (opts.toxicity) {
        runners.push(() => preloadToxicityPipeline().catch((error) => {
            logWarmupSkip("독성", error);
        }));
    }
    if (sequential) {
        for (const run of runners)
            await run();
    }
    else {
        await Promise.all(runners.map((run) => run()));
    }
}
//# sourceMappingURL=index.js.map