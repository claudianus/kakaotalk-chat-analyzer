import type { ProfanityStats } from "./types.js";
export declare function profanityLexiconVersion(): string;
export declare function loadProfanityPatterns(): string[];
/** 매칭용: 공백·제로폭 제거, 라틴 소문자 */
export declare function normalizeProfanityText(text: string): string;
export declare class ProfanityCounter {
    private readonly patterns;
    private totalHits;
    private messagesWithProfanity;
    private readonly bySender;
    constructor(patterns: string[]);
    static create(): ProfanityCounter;
    add(message: string, sender: string): void;
    buildProfanityStats(totalMessages: number, aliasBySender: Map<string, string>): ProfanityStats;
}
export declare function emptyProfanityStats(): ProfanityStats;
