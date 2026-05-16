import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { decodeChatExport } from "./encoding.js";
import { DATE_LINE_RE, parseHeaderLine, parseRecordStart } from "./kakao-line.js";
export async function parseKakaoExport(filePath) {
    const bytes = await readFile(filePath);
    const decoded = decodeChatExport(bytes);
    const physicalLines = splitPhysicalLines(decoded.text);
    const warnings = [];
    const headerLine = physicalLines.shift();
    if (!headerLine) {
        throw new Error(`Empty KakaoTalk export: ${filePath}`);
    }
    const header = parseHeaderLine(headerLine, warnings);
    const records = [];
    let current = null;
    for (let index = 0; index < physicalLines.length; index += 1) {
        const lineNumber = index + 2;
        const line = physicalLines[index] ?? "";
        if (DATE_LINE_RE.test(line)) {
            if (current)
                records.push(current);
            current = parseRecordStart(line, lineNumber, warnings);
            continue;
        }
        if (!current) {
            if (line.trim().length > 0) {
                warnings.push({
                    line: lineNumber,
                    code: "continuation_without_record",
                    message: "Found a continuation line before the first dated message.",
                });
            }
            continue;
        }
        current.message += `\n${line}`;
    }
    if (current)
        records.push(current);
    return {
        filePath,
        encoding: decoded.encoding,
        physicalLines: physicalLines.length + 1,
        records,
        warnings,
        header,
    };
}
function splitPhysicalLines(text) {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    if (normalized.endsWith("\n")) {
        lines.pop();
    }
    return lines;
}
export function describeParseResult(result) {
    const participants = new Set(result.records.map((record) => record.sender));
    const continuationRecords = result.records.filter((record) => record.message.includes("\n")).length;
    const first = result.records[0]?.rawDate ?? "(none)";
    const last = result.records.at(-1)?.rawDate ?? "(none)";
    return [
        `File: ${basename(result.filePath)}`,
        `Encoding: ${result.encoding}`,
        `Header: ${result.header.join(",")}`,
        `Physical lines: ${result.physicalLines}`,
        `Messages: ${result.records.length}`,
        `Participants: ${participants.size}`,
        `Range: ${first} -> ${last}`,
        `Multiline messages: ${continuationRecords}`,
        `Warnings: ${result.warnings.length}`,
    ].join("\n");
}
//# sourceMappingURL=parser.js.map