/** node-llama-cpp GbnfJsonSchema subset — kca LLM enrichment 출력 */
export function buildKcaLlmJsonSchema() {
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
            title: { type: "string", maxLength: 48 },
          },
        },
      },
      topicProposals: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 48 },
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
        items: { type: "string", maxLength: 120 },
      },
      insightBullets: {
        type: "array",
        maxItems: 4,
        items: { type: "string", maxLength: 120 },
      },
      shopSearchSummary: { type: "string", maxLength: 120 },
      dyadInsight: { type: "string", maxLength: 120 },
    },
  } as const;
}
