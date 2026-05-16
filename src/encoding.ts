import { createReadStream } from "node:fs";
import type { Readable } from "node:stream";
import { TextDecoder } from "node:util";
import iconv from "iconv-lite";
import type { EncodingName } from "./types.js";

interface DecodedCandidate {
  encoding: EncodingName;
  text: string;
  score: number;
}

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

export function detectEncodingFromBytes(bytes: Buffer): { encoding: EncodingName; skipBytes: number } {
  if (bytes.subarray(0, 3).equals(UTF8_BOM)) {
    return { encoding: "utf-8-bom", skipBytes: 3 };
  }

  const candidates: { encoding: EncodingName; score: number }[] = [];
  const utf8 = decodeUtf8(bytes);
  if (utf8) {
    candidates.push({ encoding: "utf-8", score: scoreDecodedText(utf8) });
  }

  for (const encoding of ["cp949", "euc-kr"] as const) {
    const text = iconv.decode(bytes, encoding);
    candidates.push({ encoding, score: scoreDecodedText(text) });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) {
    throw new Error("Unable to decode file with utf-8, cp949, or euc-kr.");
  }

  return { encoding: best.encoding, skipBytes: 0 };
}

export function openDecodedStream(filePath: string, encoding: EncodingName, skipBytes: number): Readable {
  const raw = createReadStream(filePath, { start: skipBytes });
  if (encoding === "cp949" || encoding === "euc-kr") {
    return raw.pipe(iconv.decodeStream(encoding)) as unknown as Readable;
  }
  return raw;
}

export function decodeChatExport(bytes: Buffer): { encoding: EncodingName; text: string } {
  const { encoding, skipBytes } = detectEncodingFromBytes(bytes);
  const body = bytes.subarray(skipBytes);

  if (encoding === "utf-8-bom" || encoding === "utf-8") {
    const utf8 = decodeUtf8(body) ?? body.toString("utf8");
    return { encoding, text: stripBom(utf8) };
  }

  const text = iconv.decode(body, encoding);
  return { encoding, text: stripBom(text) };
}

function decodeUtf8(bytes: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function scoreDecodedText(text: string): number {
  const sample = text.slice(0, 128 * 1024);
  let score = 0;

  if (/^Date,User,Message\b/m.test(sample)) score += 1000;
  if (/^날짜,/.test(sample)) score += 500;

  const dateMatches = sample.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},/gm)?.length ?? 0;
  score += dateMatches * 10;

  const replacementChars = (sample.match(/\uFFFD/g) ?? []).length;
  score -= replacementChars * 50;

  const hangulChars = (sample.match(/[가-힣]/g) ?? []).length;
  score += Math.min(hangulChars, 500);

  return score;
}
