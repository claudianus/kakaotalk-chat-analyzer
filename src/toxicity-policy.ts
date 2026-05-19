import type { HeuristicPrepassCollector } from "./export-prepass.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { shouldCollectSentimentSamples } from "./sentiment-policy.js";

const MIN_TOXICITY_MESSAGES = 48;

export function shouldCollectToxicitySamples(messageCount: number): boolean {
  return messageCount >= MIN_TOXICITY_MESSAGES && process.env.KCA_NO_TOXICITY !== "1";
}

/**
 * ML 독성·갈등 점수 (lexicon profanity 와 별도).
 * - quality + 번들 또는 `KCA_TOXICITY=1`
 * - `KCA_NO_TOXICITY=1` 로 끔
 */
export function resolveToxicityMl(
  options: BuildReportOptions | undefined,
  prepass: HeuristicPrepassCollector,
  sampleMessages: string[],
): boolean {
  if (process.env.KCA_NO_TOXICITY === "1") return false;
  if (options?.toxicityMl === false) return false;
  if (process.env.KCA_TOXICITY === "1") return true;
  if (!shouldCollectToxicitySamples(prepass.messageCount)) return false;
  if (options?.toxicityMl === true) return true;

  const preset = resolvePresetNameWithAuto(options, prepass.messageCount);
  if (preset === "quality" || preset === "ultra") return true;
  return false;
}
