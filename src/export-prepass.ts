import { open } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { UserWord } from "kiwi-nlp";
import { detectEncodingFromBytes, openDecodedStream } from "./encoding.js";
import { DATE_LINE_RE, parseHeaderLine, parseRecordStart } from "./kakao-line.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import { canonicalKeywordToken } from "./keyword-canonical.js";
import { KOREAN_CHAT_STOPWORDS, MORPHOLOGICAL_FRAGMENTS } from "./korean-stopwords.js";

const SAMPLE_BYTES = 512 * 1024;
const READ_HIGH_WATER_MARK = 1024 * 1024;
const HAS_TOKEN = /[가-힣A-Za-z]/;

const PREPASS_STOP = new Set<string>([...KOREAN_CHAT_STOPWORDS, ...MORPHOLOGICAL_FRAGMENTS]);

export interface ExportPrepassResult {
  messageCount: number;
  userWords: UserWord[];
}

function heuristicTokens(line: string): string[] {
  const out: string[] = [];
  for (const raw of line.split(/\s+/)) {
    if (!raw) continue;
    const t = /^[A-Za-z0-9_+-]+$/.test(raw)
      ? canonicalKeywordToken(raw.toLowerCase())
      : canonicalKeywordToken(raw.trim());
    if (t.length < 2 || t.length > 16) continue;
    if (!HAS_TOKEN.test(t)) continue;
    if (PREPASS_STOP.has(t) || isNoiseKeyword(t)) continue;
    out.push(t);
  }
  return out;
}

function isUserWordCandidate(token: string): boolean {
  if (PREPASS_STOP.has(token) || isNoiseKeyword(token)) return false;
  if (/^[A-Za-z0-9_+-]+$/.test(token)) return token.length >= 2 && token.length <= 12;
  if (/[가-힣]/.test(token)) return token.length >= 2 && token.length <= 8;
  return false;
}

/** CSV 1회 읽기: 건수 + Kiwi 사용자 사전 후보 */
export async function runExportPrepass(filePath: string): Promise<ExportPrepassResult> {
  const sample = await readFileSample(filePath, SAMPLE_BYTES);
  const { encoding, skipBytes } = detectEncodingFromBytes(sample);

  const tokenDf = new Map<string, number>();
  let messageCount = 0;

  const input = openDecodedStream(filePath, encoding, skipBytes, READ_HIGH_WATER_MARK);
  const rl = createInterface({ input, crlfDelay: Infinity });

  let lineNumber = 0;
  let currentMessage: string | null = null;

  for await (const rawLine of rl) {
    lineNumber += 1;
    const line = rawLine.replace(/\r$/, "");

    if (lineNumber === 1) {
      parseHeaderLine(line, []);
      continue;
    }

    if (DATE_LINE_RE.test(line)) {
      if (currentMessage && HAS_TOKEN.test(currentMessage)) {
        messageCount += 1;
        const seen = new Set<string>();
        for (const t of heuristicTokens(currentMessage)) {
          if (!isUserWordCandidate(t) || seen.has(t)) continue;
          seen.add(t);
          tokenDf.set(t, (tokenDf.get(t) ?? 0) + 1);
        }
      }
      const started = parseRecordStart(line, lineNumber, []);
      currentMessage = started.message;
      continue;
    }

    if (currentMessage !== null) {
      currentMessage = `${currentMessage}\n${line}`;
    }
  }

  if (currentMessage && HAS_TOKEN.test(currentMessage)) {
    messageCount += 1;
    const seen = new Set<string>();
    for (const t of heuristicTokens(currentMessage)) {
      if (!isUserWordCandidate(t) || seen.has(t)) continue;
      seen.add(t);
      tokenDf.set(t, (tokenDf.get(t) ?? 0) + 1);
    }
  }

  const userWords: UserWord[] = [...tokenDf.entries()]
    .filter(([, df]) => df >= 3)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 72)
    .map(([word, df]) => ({
      word,
      tag: /^[A-Za-z]/.test(word) ? "SL" : "NNP",
      score: Math.min(8, Math.log1p(df)),
    }));

  return { messageCount, userWords };
}

async function readFileSample(filePath: string, maxBytes: number): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buf, 0, maxBytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}
