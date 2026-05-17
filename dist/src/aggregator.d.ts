import type { ChatRecord, EncodingName, PrivacyMode, ReportData } from "./types.js";
export interface FinalizeSourceMeta {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
}
export interface FinalizeOptions {
    usedSemanticKeywords?: boolean;
    koreanPrimary?: boolean;
}
export interface AggregatorOptions {
    /** 시맨틱 키워드용 메시지 샘플 수집 */
    semanticSamples?: boolean;
    /** 시맨틱 리저보어 상한 추정(스트리밍 시 생략 가능) */
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
    private readonly dyads;
    private total;
    private totalCharacters;
    private messagesWithLinks;
    private messagesWithAttachments;
    private nightMessages;
    private emojiMessages;
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
    private roomPhotoBundleMessages;
    private pureLaughMessages;
    private openChatBoilerplateExcluded;
    private semanticThemeCandidates;
    private readonly semanticReservoir;
    private prevMs;
    private prevSender;
    private runSender;
    private runLen;
    private firstDate;
    private lastDate;
    constructor(filePath: string, privacy: PrivacyMode, top: number, options?: AggregatorOptions);
    drainSemanticSamples(): string[];
    messageCount(): number;
    resetKeywordPipeline(): void;
    private consumeKeywords;
    applySemanticKeywordBoost(items: {
        label: string;
        messageHits: number;
        score?: number;
    }[]): void;
    consume(record: ChatRecord, opts?: {
        keywordsOnly?: boolean;
        skipKeywords?: boolean;
    }): void;
    private bumpSystemNotice;
    finalize(meta: FinalizeSourceMeta, finalizeOpts?: FinalizeOptions): ReportData;
}
