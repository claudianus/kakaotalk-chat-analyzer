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
