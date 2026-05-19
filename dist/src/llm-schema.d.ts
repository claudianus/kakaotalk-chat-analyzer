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
                        type: string;
                        maxLength: number;
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
                        type: string;
                        maxLength: number;
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
                type: string;
                maxLength: number;
            };
        };
        readonly insightBullets: {
            readonly type: "array";
            readonly maxItems: 4;
            readonly items: {
                type: string;
                maxLength: number;
            };
        };
        readonly shopSearchSummary: {
            type: string;
            maxLength: number;
        };
        readonly dyadInsight: {
            type: string;
            maxLength: number;
        };
        readonly roomArchetype: {
            readonly type: "object";
            readonly properties: {
                readonly name: {
                    type: string;
                    maxLength: number;
                };
                readonly description: {
                    type: string;
                    maxLength: number;
                };
                readonly traits: {
                    readonly type: "array";
                    readonly maxItems: 4;
                    readonly items: {
                        readonly type: "string";
                        readonly maxLength: 32;
                    };
                };
            };
        };
        readonly moments: {
            readonly type: "array";
            readonly maxItems: 5;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly headline: {
                        type: string;
                        maxLength: number;
                    };
                    readonly statRef: {
                        readonly type: "string";
                        readonly maxLength: 80;
                    };
                };
            };
        };
        readonly relationshipBeats: {
            readonly type: "array";
            readonly maxItems: 4;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly pair: {
                        type: string;
                        maxLength: number;
                    };
                    readonly beat: {
                        type: string;
                        maxLength: number;
                    };
                    readonly role: {
                        readonly type: "string";
                        readonly maxLength: 24;
                    };
                };
            };
        };
        readonly episodeCards: {
            readonly type: "array";
            readonly maxItems: 6;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly period: {
                        type: string;
                        maxLength: number;
                    };
                    readonly title: {
                        type: string;
                        maxLength: number;
                    };
                    readonly tagline: {
                        type: string;
                        maxLength: number;
                    };
                    readonly emoji: {
                        readonly type: "string";
                        readonly maxLength: 4;
                    };
                };
            };
        };
        readonly eraLabels: {
            readonly type: "array";
            readonly maxItems: 3;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly label: {
                        type: string;
                        maxLength: number;
                    };
                    readonly detail: {
                        type: string;
                        maxLength: number;
                    };
                };
            };
        };
        readonly insideJokes: {
            readonly type: "array";
            readonly maxItems: 5;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly label: {
                        type: string;
                        maxLength: number;
                    };
                    readonly whyFunny: {
                        type: string;
                        maxLength: number;
                    };
                    readonly evidenceKeywords: {
                        readonly type: "array";
                        readonly maxItems: 4;
                        readonly items: {
                            readonly type: "string";
                            readonly maxLength: 32;
                        };
                    };
                };
            };
        };
        readonly characterCards: {
            readonly type: "array";
            readonly maxItems: 3;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly alias: {
                        type: string;
                        maxLength: number;
                    };
                    readonly tagline: {
                        type: string;
                        maxLength: number;
                    };
                    readonly statHook: {
                        readonly type: "string";
                        readonly maxLength: 60;
                    };
                };
            };
        };
        readonly dayMicroStories: {
            readonly type: "array";
            readonly maxItems: 5;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly date: {
                        readonly type: "string";
                        readonly maxLength: 10;
                    };
                    readonly line: {
                        type: string;
                        maxLength: number;
                    };
                };
            };
        };
        readonly shareLine: {
            readonly type: "string";
            readonly maxLength: 160;
        };
        readonly hashtags: {
            readonly type: "array";
            readonly maxItems: 3;
            readonly items: {
                readonly type: "string";
                readonly maxLength: 24;
            };
        };
        readonly counterfactuals: {
            readonly type: "array";
            readonly maxItems: 2;
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly text: {
                        type: string;
                        maxLength: number;
                    };
                };
            };
        };
    };
};
