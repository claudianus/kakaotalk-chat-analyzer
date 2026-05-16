import type { ParseResult } from "./types.js";
export declare function parseKakaoExport(filePath: string): Promise<ParseResult>;
export declare function describeParseResult(result: ParseResult): string;
