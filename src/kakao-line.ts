import { parse as parseCsv } from "csv-parse/sync";
import { parseKakaoDate } from "./date.js";
import type { ChatRecord, ParseWarning } from "./types.js";

export const DATE_LINE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},/;

export function parseHeaderLine(line: string, warnings: ParseWarning[]): string[] {
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

export function parseRecordStart(line: string, lineNumber: number, warnings: ParseWarning[]): ChatRecord {
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
