import { open } from "node:fs/promises";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { detectEncodingFromBytes, openDecodedStream } from "./encoding.js";
import { DATE_LINE_RE, parseHeaderLine, parseRecordStart } from "./kakao-line.js";
const SAMPLE_BYTES = 512 * 1024;
export async function* streamKakaoExport(filePath) {
    const sample = await readFileSample(filePath, SAMPLE_BYTES);
    const { encoding, skipBytes } = detectEncodingFromBytes(sample);
    const warnings = [];
    const input = openDecodedStream(filePath, encoding, skipBytes);
    const rl = createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    let header = [];
    let current = null;
    let physicalLines = 0;
    for await (const rawLine of rl) {
        lineNumber += 1;
        physicalLines += 1;
        const line = rawLine.replace(/\r$/, "");
        if (lineNumber === 1) {
            if (!line.trim()) {
                throw new Error(`Empty KakaoTalk export: ${filePath}`);
            }
            header = parseHeaderLine(line, warnings);
            continue;
        }
        if (DATE_LINE_RE.test(line)) {
            if (current) {
                yield { type: "record", record: current };
                current = null;
            }
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
    if (current) {
        yield { type: "record", record: current };
    }
    yield {
        type: "meta",
        meta: {
            filePath,
            encoding,
            physicalLines,
            warnings,
            header,
        },
    };
}
export async function describeStreamedExport(filePath) {
    let messages = 0;
    let multiline = 0;
    const participants = new Set();
    let first = null;
    let last = null;
    let meta = null;
    for await (const event of streamKakaoExport(filePath)) {
        if (event.type === "meta") {
            meta = event.meta;
            continue;
        }
        messages += 1;
        if (event.record.message.includes("\n"))
            multiline += 1;
        participants.add(event.record.sender);
        if (!first)
            first = event.record.rawDate;
        last = event.record.rawDate;
    }
    if (!meta) {
        throw new Error(`Empty or unreadable export: ${filePath}`);
    }
    const text = [
        `File: ${basename(meta.filePath)}`,
        `Encoding: ${meta.encoding}`,
        `Header: ${meta.header.join(",")}`,
        `Physical lines: ${meta.physicalLines}`,
        `Messages: ${messages}`,
        `Participants: ${participants.size}`,
        `Range: ${first ?? "(none)"} -> ${last ?? "(none)"}`,
        `Multiline messages: ${multiline}`,
        `Warnings: ${meta.warnings.length}`,
    ].join("\n");
    return { text, warnings: meta.warnings };
}
async function readFileSample(filePath, maxBytes) {
    const handle = await open(filePath, "r");
    try {
        const buf = Buffer.alloc(maxBytes);
        const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
        return buf.subarray(0, bytesRead);
    }
    finally {
        await handle.close();
    }
}
//# sourceMappingURL=stream-parser.js.map