import type { StreamParseOptions } from "./stream-options.js";
import type { ChatRecord, EncodingName, ParseWarning } from "./types.js";
export interface StreamParseMeta {
    filePath: string;
    encoding: EncodingName;
    physicalLines: number;
    warnings: ParseWarning[];
    header: string[];
}
export type StreamParseEvent = {
    type: "meta";
    meta: StreamParseMeta;
} | {
    type: "record";
    record: ChatRecord;
};
export declare function streamKakaoExport(filePath: string, options?: StreamParseOptions): AsyncGenerator<StreamParseEvent>;
/** DATE 줄만 세어 메시지 건수 추정(진행률 %용, CSV 2회 읽기) */
export declare function estimateKakaoMessageCount(filePath: string): Promise<number>;
export declare function describeStreamedExport(filePath: string): Promise<{
    text: string;
    warnings: ParseWarning[];
}>;
