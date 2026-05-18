import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export declare function shouldCollectToxicitySamples(messageCount: number): boolean;
/**
 * ML 독성·갈등 점수 (lexicon profanity 와 별도).
 * - quality + 번들 또는 `KCA_TOXICITY=1`
 * - `KCA_NO_TOXICITY=1` 로 끔
 */
export declare function resolveToxicityMl(options: BuildReportOptions | undefined, prepass: HeuristicPrepassCollector, sampleMessages: string[]): boolean;
