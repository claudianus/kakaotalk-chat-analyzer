import type { ChatRecord, ParseWarning } from "./types.js";
export declare const DATE_LINE_RE: RegExp;
export declare function parseHeaderLine(line: string, warnings: ParseWarning[]): string[];
export declare function parseRecordStart(line: string, lineNumber: number, warnings: ParseWarning[]): ChatRecord;
