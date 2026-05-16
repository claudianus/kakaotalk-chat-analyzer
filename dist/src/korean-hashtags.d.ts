export interface HashtagKeywordOptions {
    senderNames: ReadonlySet<string>;
    exclude?: ReadonlySet<string>;
}
/** KR-WordRank 보조: 메시지당 해시태그 1회 */
export declare function extractHashtagKeywords(message: string, options: HashtagKeywordOptions): string[];
