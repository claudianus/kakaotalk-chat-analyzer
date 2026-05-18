/** node-llama-cpp GbnfJsonSchema subset — kca LLM enrichment 출력 */
export declare function buildKcaLlmJsonSchema(): {
    readonly type: "object";
    readonly properties: {
        readonly topicTitles: {
            readonly type: "array";
            readonly maxItems: 12;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly i: {
                        readonly type: "integer";
                    };
                    readonly title: {
                        readonly type: "string";
                        readonly maxLength: 48;
                    };
                };
            };
        };
        readonly topicProposals: {
            readonly type: "array";
            readonly maxItems: 3;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly title: {
                        readonly type: "string";
                        readonly maxLength: 48;
                    };
                    readonly terms: {
                        readonly type: "array";
                        readonly maxItems: 6;
                        readonly items: {
                            readonly type: "string";
                            readonly maxLength: 32;
                        };
                    };
                };
            };
        };
        readonly paragraphs: {
            readonly type: "array";
            readonly minItems: 2;
            readonly maxItems: 3;
            readonly items: {
                readonly type: "string";
                readonly maxLength: 120;
            };
        };
        readonly insightBullets: {
            readonly type: "array";
            readonly maxItems: 4;
            readonly items: {
                readonly type: "string";
                readonly maxLength: 120;
            };
        };
        readonly shopSearchSummary: {
            readonly type: "string";
            readonly maxLength: 120;
        };
        readonly dyadInsight: {
            readonly type: "string";
            readonly maxLength: 120;
        };
    };
};
