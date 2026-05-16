import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import { decodeChatExport } from "./encoding.js";
import { parseKakaoDate } from "./date.js";
import type { ChatRecord, ParseResult, ParseWarning } from "./types.js";

const DATE_LINE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},/;

export async function parseKakaoExport(filePath: string): Promise<ParseResult> {
  const bytes = await readFile(filePath);
  const decoded = decodeChatExport(bytes);
  const physicalLines = splitPhysicalLines(decoded.text);
  const warnings: ParseWarning[] = [];
  const headerLine = physicalLines.shift();

  if (!headerLine) {
    throw new Error(`Empty KakaoTalk export: ${filePath}`);
  }

  const header = parseHeader(headerLine, warnings);
  const records: ChatRecord[] = [];
  let current: ChatRecord | null = null;

  for (let index = 0; index < physicalLines.length; index += 1) {
    const lineNumber = index + 2;
    const line = physicalLines[index] ?? "";

    if (DATE_LINE_RE.test(line)) {
      if (current) records.push(current);
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

  if (current) records.push(current);

  return {
    filePath,
    encoding: decoded.encoding,
    physicalLines: physicalLines.length + 1,
    records,
    warnings,
    header,
  };
}

function splitPhysicalLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) {
    lines.pop();
  }
  return lines;
}

function parseHeader(line: string, warnings: ParseWarning[]): string[] {
  const header = parseCsvLine(line, 1, warnings);
  const normalized = header.map((field) => field.trim());
  const expected = ["Date", "User", "Message"];

  if (normalized.length < 3 || expected.some((value, index) => normalized[index] !== value)) {
    warnings.push({
      line: 1,
      code: "unexpected_header",
      message: `Expected Date,User,Message header but found ${normalized.join(",") || "(empty)"}.`,
    });
  }

  return normalized;
}

function parseRecordStart(line: string, lineNumber: number, warnings: ParseWarning[]): ChatRecord {
  const { rawDate, sender, message } = parseRecordStartLine(line, lineNumber, warnings);
  const date = parseKakaoDate(rawDate);

  if (!date) {
    warnings.push({
      line: lineNumber,
      code: "invalid_date",
      message: `Could not parse message date on line ${lineNumber}.`,
    });
  }

  return {
    line: lineNumber,
    rawDate,
    date: date ?? { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
    sender,
    message,
  };
}

function parseRecordStartLine(
  line: string,
  lineNumber: number,
  warnings: ParseWarning[],
): { rawDate: string; sender: string; message: string } {
  const firstComma = line.indexOf(",");
  if (firstComma === -1) {
    warnings.push({
      line: lineNumber,
      code: "record_start_parse_error",
      message: "Dated record line did not contain a field delimiter.",
    });
    return { rawDate: line, sender: "", message: "" };
  }

  const rawDate = line.slice(0, firstComma);
  const rest = line.slice(firstComma + 1);
  const senderResult = readCsvField(rest);
  if (!senderResult) {
    warnings.push({
      line: lineNumber,
      code: "sender_parse_error",
      message: "Could not parse sender field from dated record line.",
    });
    const secondComma = rest.indexOf(",");
    return {
      rawDate,
      sender: secondComma === -1 ? rest : rest.slice(0, secondComma),
      message: secondComma === -1 ? "" : rest.slice(secondComma + 1),
    };
  }

  const messageStart = rest[senderResult.nextIndex] === "," ? senderResult.nextIndex + 1 : senderResult.nextIndex;
  return {
    rawDate,
    sender: senderResult.value,
    message: unquoteCompleteCsvField(rest.slice(messageStart)),
  };
}

function readCsvField(input: string): { value: string; nextIndex: number } | null {
  if (!input.startsWith('"')) {
    const comma = input.indexOf(",");
    return {
      value: comma === -1 ? input : input.slice(0, comma),
      nextIndex: comma === -1 ? input.length : comma,
    };
  }

  let value = "";
  for (let index = 1; index < input.length; index += 1) {
    const char = input[index];
    if (char !== '"') {
      value += char;
      continue;
    }

    if (input[index + 1] === '"') {
      value += '"';
      index += 1;
      continue;
    }

    return { value, nextIndex: index + 1 };
  }

  return null;
}

function parseCsvLine(line: string, lineNumber: number, warnings: ParseWarning[]): string[] {
  try {
    const rows = parseCsv(line, {
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: false,
    }) as string[][];
    const fields = rows[0] ?? [];
    return fields.map((field) => String(field));
  } catch (error) {
    warnings.push({
      line: lineNumber,
      code: "csv_parse_error",
      message: error instanceof Error ? error.message : String(error),
    });
    return fallbackSplit(line);
  }
}

function fallbackSplit(line: string): string[] {
  const firstComma = line.indexOf(",");
  if (firstComma === -1) return [line];

  const secondComma = line.indexOf(",", firstComma + 1);
  if (secondComma === -1) return [line.slice(0, firstComma), line.slice(firstComma + 1)];

  return [line.slice(0, firstComma), unquote(line.slice(firstComma + 1, secondComma)), line.slice(secondComma + 1)];
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  return value;
}

function unquoteCompleteCsvField(value: string): string {
  const parsed = readCsvField(value);
  if (!parsed || parsed.nextIndex !== value.length) {
    return value;
  }
  return parsed.value;
}

export function describeParseResult(result: ParseResult): string {
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
