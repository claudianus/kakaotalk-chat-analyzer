import type { EncodingName } from "./types.js";
export declare function decodeChatExport(bytes: Buffer): {
    encoding: EncodingName;
    text: string;
};
