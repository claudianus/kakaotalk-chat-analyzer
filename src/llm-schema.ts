import type { Qwen35Size } from "./llm-qwen35.js";

/** node-llama-cpp GbnfJsonSchema subset — kca LLM enrichment 출력 */
export function buildKcaLlmJsonSchema() {
  const shortStr = { type: "string", maxLength: 120 };
  const medStr = { type: "string", maxLength: 48 };
  return {
    type: "object",
    properties: {
      topicTitles: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          properties: {
            i: { type: "integer" },
            title: medStr,
          },
        },
      },
      topicProposals: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: medStr,
            terms: {
              type: "array",
              maxItems: 6,
              items: { type: "string", maxLength: 32 },
            },
          },
        },
      },
      paragraphs: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: shortStr,
      },
      insightBullets: {
        type: "array",
        maxItems: 4,
        items: shortStr,
      },
      shopSearchSummary: shortStr,
      dyadInsight: shortStr,
      roomArchetype: {
        type: "object",
        properties: {
          name: medStr,
          description: shortStr,
          traits: { type: "array", maxItems: 4, items: { type: "string", maxLength: 32 } },
        },
      },
      moments: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            headline: shortStr,
            statRef: { type: "string", maxLength: 80 },
          },
        },
      },
      relationshipBeats: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            pair: medStr,
            beat: shortStr,
            role: { type: "string", maxLength: 24 },
          },
        },
      },
      episodeCards: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            period: medStr,
            title: medStr,
            tagline: shortStr,
            emoji: { type: "string", maxLength: 4 },
          },
        },
      },
      eraLabels: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            label: medStr,
            detail: shortStr,
          },
        },
      },
      insideJokes: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            label: medStr,
            whyFunny: shortStr,
            evidenceKeywords: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 32 },
            },
          },
        },
      },
      characterCards: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            alias: medStr,
            tagline: shortStr,
            statHook: { type: "string", maxLength: 60 },
          },
        },
      },
      dayMicroStories: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            date: { type: "string", maxLength: 10 },
            line: shortStr,
          },
        },
      },
      shareLine: { type: "string", maxLength: 160 },
      hashtags: {
        type: "array",
        maxItems: 3,
        items: { type: "string", maxLength: 24 },
      },
      counterfactuals: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          properties: { text: shortStr },
        },
      },
    },
  } as const;
}

/** 사후 파싱용 — grammar보다 완화 (paragraphs 1개도 허용) */
export function buildKcaLlmJsonParseSchema() {
  const schema = structuredClone(buildKcaLlmJsonSchema()) as {
    properties?: { paragraphs?: { minItems?: number } };
  };
  if (schema.properties?.paragraphs) {
    schema.properties.paragraphs.minItems = 1;
  }
  return schema;
}

/** grammar·프롬프트 복잡도 — SLM은 minimal/compact가 JSONSchemaBench 기준 유리 */
export type LlmSchemaTier = "full" | "compact" | "minimal";

const SCHEMA_TIER_KEYS: Record<LlmSchemaTier, string[]> = {
  minimal: ["paragraphs", "insightBullets", "roomArchetype"],
  compact: ["paragraphs", "insightBullets", "roomArchetype", "topicProposals"],
  full: [
    "topicTitles",
    "topicProposals",
    "paragraphs",
    "insightBullets",
    "shopSearchSummary",
    "dyadInsight",
    "roomArchetype",
    "moments",
    "relationshipBeats",
    "episodeCards",
    "eraLabels",
    "insideJokes",
    "characterCards",
    "dayMicroStories",
    "shareLine",
    "hashtags",
    "counterfactuals",
  ],
};

/** 티어별 JSON Schema — constrained decoding 부담 축소 */
export function buildKcaLlmJsonSchemaTier(tier: LlmSchemaTier) {
  const full = buildKcaLlmJsonSchema() as {
    properties: Record<string, unknown>;
  };
  const properties: Record<string, unknown> = {};
  for (const key of SCHEMA_TIER_KEYS[tier]) {
    const prop = full.properties[key];
    if (prop) properties[key] = structuredClone(prop);
  }
  if (tier === "compact" && properties.topicProposals) {
    const tp = properties.topicProposals as { maxItems?: number };
    tp.maxItems = 2;
  }
  return { type: "object", properties };
}

/** 모델 크기·repair 단계에 맞는 grammar 스키마 */
export function resolveLlmSchemaTier(args: {
  modelSize: Qwen35Size;
  compact: boolean;
  repairAttempt: boolean;
}): LlmSchemaTier {
  if (args.compact || args.repairAttempt) return "minimal";
  if (args.modelSize === "0.8B" || args.modelSize === "2B") return "compact";
  return "full";
}
