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
export declare function describeStreamedExport(filePath: string): Promise<{
    text: string;
    warnings: ParseWarning[];
}>;
