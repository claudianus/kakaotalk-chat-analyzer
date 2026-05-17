import type { ChatRecord } from "./types.js";
export declare function createMessageSpoolPath(): Promise<string>;
export declare function removeSpool(spoolPath: string | null): Promise<void>;
export interface SpoolKeywordPassOptions {
    since?: string;
    progressEvery?: number;
    onProgress?: (count: number) => void;
}
export declare function iterateSpoolRecords(spoolPath: string): AsyncGenerator<ChatRecord>;
