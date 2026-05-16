import type { ChatRecord, EncodingName, PrivacyMode, ReportData } from "./types.js";
export interface FinalizeSourceMeta {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warningCount: number;
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
    private readonly keywordCounter;
    private readonly gapStats;
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
    private prevMs;
    private prevSender;
    private runSender;
    private runLen;
    private firstDate;
    private lastDate;
    constructor(filePath: string, privacy: PrivacyMode, top: number);
    consume(record: ChatRecord): void;
    finalize(meta: FinalizeSourceMeta): ReportData;
}
