import type { Readable } from "node:stream";
import type { EncodingName } from "./types.js";
export declare function detectEncodingFromBytes(bytes: Buffer): {
    encoding: EncodingName;
    skipBytes: number;
};
export declare function openDecodedStream(filePath: string, encoding: EncodingName, skipBytes: number): Readable;
export declare function decodeChatExport(bytes: Buffer): {
    encoding: EncodingName;
    text: string;
};
