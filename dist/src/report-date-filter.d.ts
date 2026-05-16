import type { ChatRecord } from "./types.js";
/** YYYY-MM-DD — since 이상만 통과 */
export declare function recordOnOrAfter(record: ChatRecord, sinceYmd: string): boolean;
export declare function parseSinceOption(since: string | undefined): string | undefined;
