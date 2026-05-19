import {
  BUNDLED_EMBED_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  BUNDLED_TOXICITY_MODEL_ID,
  isBundledEmbedModelReady,
  isBundledSentimentModelReady,
  isBundledToxicityModelReady,
  resolveBundledSentimentModelId,
} from "../ml-bundled-models.js";
import { memoryHeadroomGb, probeMachineProfileSync } from "../analysis-capability.js";
import type { AnalysisPresetName } from "../analysis-preset.js";
import {
  resolveDefaultSemanticHubId,
  shouldPreferBundledSemantic,
} from "../semantic-model-resolve.js";
import {
  HUB_KCELECTRA_TOXICITY,
  HUB_KOELECTRA_EMBED,
  HUB_KOELECTRA_KORSTS,
  HUB_KOELECTRA_NSMC,
} from "./model-ids.js";

export type MlTask = "sentiment" | "embedding" | "toxicity";

export interface MlModelSpec {
  task: MlTask;
  bundledId: string;
  hubFallback: string;
  hubTask: "text-classification" | "feature-extraction";
}

export const ML_MODEL_REGISTRY: Record<MlTask, MlModelSpec> = {
  sentiment: {
    task: "sentiment",
    bundledId: BUNDLED_SENTIMENT_MODEL_ID,
    hubFallback: HUB_KOELECTRA_NSMC,
    hubTask: "text-classification",
  },
  embedding: {
    task: "embedding",
    bundledId: BUNDLED_EMBED_MODEL_ID,
    hubFallback: HUB_KOELECTRA_EMBED,
    hubTask: "feature-extraction",
  },
  toxicity: {
    task: "toxicity",
    bundledId: BUNDLED_TOXICITY_MODEL_ID,
    hubFallback: HUB_KCELECTRA_TOXICITY,
    hubTask: "text-classification",
  },
};

export function isBundledModelReady(task: MlTask): boolean {
  if (task === "sentiment") return isBundledSentimentModelReady();
  if (task === "embedding") return isBundledEmbedModelReady();
  return isBundledToxicityModelReady();
}

export function resolveSentimentBundledId(): string {
  return resolveBundledSentimentModelId();
}

export function resolveEmbeddingModelId(preset?: string): string {
  const env = process.env.KCA_SEMANTIC_MODEL?.trim();
  if (env) return env;
  const name = (preset ?? "balanced") as AnalysisPresetName;
  const headroom = memoryHeadroomGb(probeMachineProfileSync());
  if (shouldPreferBundledSemantic(name, headroom)) return BUNDLED_EMBED_MODEL_ID;
  return resolveDefaultSemanticHubId(name, headroom);
}

export function resolveToxicityModelId(): string {
  const env = process.env.KCA_TOXICITY_MODEL?.trim();
  if (env) return env;
  if (process.env.KCA_TOXICITY_HUB_ONLY === "1") return HUB_KCELECTRA_TOXICITY;
  return BUNDLED_TOXICITY_MODEL_ID;
}
