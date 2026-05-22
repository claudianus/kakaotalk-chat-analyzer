import type { ChatRecord, EncodingName, PrivacyMode, ReportData, SentimentStats, ToxicityStats } from "./types.js";
import type { BuildReportOptions } from "./analyze-pool.js";
export interface FinalizeSourceMeta {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
}
export interface FinalizeOptions {
    usedSemanticKeywords?: boolean;
    usedSentimentAnalysis?: boolean;
    usedToxicityAnalysis?: boolean;
    koreanPrimary?: boolean;
    useEmbeddingTopics?: boolean;
    semanticSupplementRrfWeight?: number;
    embeddingThemeCap?: number;
}
/** 시맨틱 supplement messageHits 상한 — RRF 독점 방지 */
export declare function semanticSupplementHitCap(corpusMessages: number): number;
export interface AggregatorOptions {
    /** 시맨틱 키워드용 메시지 샘플 수집 */
    semanticSamples?: boolean;
    /** 감정 분석용 메시지 샘플 수집 */
    sentimentSamples?: boolean;
    /** 시맨틱·감정 리저보어 상한 추정(스트리밍 시 생략 가능) */
    estimatedMessages?: number;
}
export declare class ReportAggregator {
    private readonly filePath;
    private readonly privacy;
    private readonly top;
    private readonly senderStats;
    private readonly senderNamesNormalized;
    private readonly sendersRegistered;
    private readonly daily;
    private readonly monthly;
    private readonly hourly;
    private readonly weekdays;
    private readonly attachments;
    private readonly domains;
    private keywordStream;
    private topicMap;
    private readonly keywordSupplement;
    private readonly repeatPhraseCounter;
    private readonly shopSearchTopics;
    private readonly gapStats;
    private readonly sessionGapStats;
    private readonly dailySenderCounts;
    private readonly laughBySender;
    private readonly shortBySender;
    private readonly dailyJoin;
    private readonly dailyLeave;
    private readonly dailyHidden;
    private readonly dailyKick;
    private readonly dailyNewSenders;
    private readonly dailyLinks;
    private readonly dailyPlanSignals;
    private readonly monthlyKeywordBuckets;
    private readonly dailyKeywordBuckets;
    private readonly dyads;
    private readonly dailySentimentCounters;
    private readonly senderHonorificCounts;
    private total;
    private totalCharacters;
    private messagesWithLinks;
    private messagesWithAttachments;
    private nightMessages;
    private emojiMessages;
    private emojiSentimentCounts;
    private topEmojis;
    private weekendMessages;
    private questionMessages;
    private speakerSwitches;
    private monologueMessages;
    private laughMessages;
    private shortMessages;
    private roomJoinMessages;
    private roomLeaveMessages;
    private roomDeletedMessages;
    private roomHiddenMessages;
    private roomKickMessages;
    private roomSlowOnMessages;
    private roomSlowOffMessages;
    private roomSubManagerMessages;
    private roomManagerMessages;
    private roomShopSearchMessages;
    private shopSearchUntaggedNotices;
    private readonly shopSearchMissSamples;
    private roomPhotoBundleMessages;
    private pureLaughMessages;
    private openChatBoilerplateExcluded;
    private semanticThemeCandidates;
    private readonly semanticReservoir;
    private readonly sentimentReservoir;
    private readonly profanityCounter;
    private sentimentStats;
    private toxicityStats;
    /** stats pass에서 리저보어를 채웠으면 keyword pass 중복 push 방지 */
    private samplesCollectedInStatsPass;
    private prevMs;
    private prevSender;
    private runSender;
    private runLen;
    private firstDate;
    private lastDate;
    constructor(filePath: string, privacy: PrivacyMode, top: number, options?: AggregatorOptions);
    /** 스트리밍 1패스 후 실제 건수로 리저보어 상한 보정(추정치 과소 시) */
    ensureSampleCaps(messageCount: number): void;
    drainSemanticSamples(buildOptions?: BuildReportOptions): string[];
    drainSentimentSamples(): {
        text: string;
        sender: string;
    }[];
    applySentimentStats(stats: SentimentStats): void;
    applyToxicityStats(stats: ToxicityStats): void;
    senderAliasMap(): Map<string, string>;
    messageCount(): number;
    resetKeywordPipeline(): void;
    markSamplesCollectedInStatsPass(): void;
    applyKeywordTokens(kwTokens: string[], monthKey: string): void;
    private pushAnalysisSamples;
    private pushSemanticSample;
    private consumeKeywords;
    applySemanticKeywordBoost(items: {
        label: string;
        messageHits: number;
        score?: number;
    }[]): void;
    /** finalize 직전 — BM25 후보에만 시맨틱 RRF 보강(표시 빈도는 코퍼스 df) */
    applySemanticSupplementForRanked(wordRankItems: {
        label: string;
        messageHits: number;
    }[]): void;
    consume(record: ChatRecord, opts?: {
        keywordsOnly?: boolean;
        skipKeywords?: boolean;
        collectSamples?: boolean;
    }): void;
    private bumpSystemNotice;
    finalize(meta: FinalizeSourceMeta, finalizeOpts?: FinalizeOptions): ReportData;
}
