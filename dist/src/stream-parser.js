import { open, stat } from "node:fs/promises";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { detectEncodingFromBytes, openDecodedStream } from "./encoding.js";
import { DATE_LINE_RE, parseHeaderLine, parseRecordStart } from "./kakao-line.js";
const SAMPLE_BYTES = 512 * 1024;
const READ_HIGH_WATER_MARK = 1024 * 1024;
function toChatRecord(pending) {
    return {
        line: pending.line,
        rawDate: pending.rawDate,
        date: pending.date,
        sender: pending.sender,
        message: pending.parts.length === 1 ? pending.parts[0] : pending.parts.join("\n"),
    };
}
export async function* streamKakaoExport(filePath, options) {
    const sample = await readFileSample(filePath, SAMPLE_BYTES);
    const { encoding, skipBytes } = detectEncodingFromBytes(sample);
    const warnings = [];
    const input = openDecodedStream(filePath, encoding, skipBytes, READ_HIGH_WATER_MARK);
    const rl = createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    let header = [];
    let current = null;
    let physicalLines = 0;
    let recordCount = 0;
    const progressEvery = options?.progressEvery ?? 25_000;
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
                recordCount += 1;
                if (options?.onProgress && recordCount % progressEvery === 0) {
                    options.onProgress(recordCount);
                }
                yield { type: "record", record: toChatRecord(current) };
                current = null;
            }
            const started = parseRecordStart(line, lineNumber, warnings);
            current = {
                line: started.line,
                rawDate: started.rawDate,
                date: started.date,
                sender: started.sender,
                parts: [started.message],
            };
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
        current.parts.push(line);
    }
    if (current) {
        yield { type: "record", record: toChatRecord(current) };
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
/** DATE 줄만 세어 메시지 건수 추정(진행률 %용).
 * 512KB 초과 파일은 파일 크기 기반 휴리스틱으로 빠르게 추정합니다. */
export async function estimateKakaoMessageCount(filePath) {
    // 빠른 휴리스틱: 카카오톡 CSV 평균 ~200바이트/메시지
    const { size } = await stat(filePath);
    if (size > SAMPLE_BYTES) {
        const estimate = Math.ceil(size / 200);
        // 오차 보정 마진 +10% (멀티라인 메시지 등)
        return Math.ceil(estimate * 1.1);
    }
    // 작은 파일만 정밀 카운트
    const sample = await readFileSample(filePath, SAMPLE_BYTES);
    const { encoding, skipBytes } = detectEncodingFromBytes(sample);
    const input = openDecodedStream(filePath, encoding, skipBytes, READ_HIGH_WATER_MARK);
    const rl = createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    let count = 0;
    for await (const rawLine of rl) {
        lineNumber += 1;
        const line = rawLine.replace(/\r$/, "");
        if (lineNumber === 1)
            continue;
        if (DATE_LINE_RE.test(line))
            count += 1;
    }
    return count;
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