import { open } from "node:fs/promises";
import { createInterface } from "node:readline";
import { detectEncodingFromBytes, openDecodedStream } from "./encoding.js";
import { DATE_LINE_RE, parseHeaderLine, parseRecordStart } from "./kakao-line.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import { canonicalKeywordToken } from "./keyword-canonical.js";
import { countScriptChars } from "./korean-locale.js";
import { KOREAN_CHAT_STOPWORDS, MORPHOLOGICAL_FRAGMENTS } from "./korean-stopwords.js";
const SAMPLE_BYTES = 512 * 1024;
const READ_HIGH_WATER_MARK = 1024 * 1024;
const HAS_TOKEN = /[가-힣A-Za-z]/;
const PREPASS_STOP = new Set([...KOREAN_CHAT_STOPWORDS, ...MORPHOLOGICAL_FRAGMENTS]);
function heuristicTokens(line) {
    const out = [];
    for (const raw of line.split(/\s+/)) {
        if (!raw)
            continue;
        const t = /^[A-Za-z0-9_+-]+$/.test(raw)
            ? canonicalKeywordToken(raw.toLowerCase())
            : canonicalKeywordToken(raw.trim());
        if (t.length < 2 || t.length > 16)
            continue;
        if (!HAS_TOKEN.test(t))
            continue;
        if (PREPASS_STOP.has(t) || isNoiseKeyword(t))
            continue;
        out.push(t);
    }
    return out;
}
function isUserWordCandidate(token) {
    if (PREPASS_STOP.has(token) || isNoiseKeyword(token))
        return false;
    if (/^[A-Za-z0-9_+-]+$/.test(token))
        return token.length >= 2 && token.length <= 12;
    if (/[가-힣]/.test(token))
        return token.length >= 2 && token.length <= 8;
    return false;
}
/** 스트리밍 분석과 함께 쓰는 휴리스틱 userWords·건수 수집 */
export class HeuristicPrepassCollector {
    tokenDf = new Map();
    sampleMessages = [];
    maxSamples = 220;
    corpusHangul = 0;
    corpusLatin = 0;
    messageCount = 0;
    onMessageText(message) {
        if (!HAS_TOKEN.test(message))
            return;
        this.messageCount += 1;
        const script = countScriptChars(message);
        this.corpusHangul += script.hangul;
        this.corpusLatin += script.latin;
        if (this.sampleMessages.length < this.maxSamples) {
            this.sampleMessages.push(message);
        }
        const seen = new Set();
        for (const t of heuristicTokens(message)) {
            if (!isUserWordCandidate(t) || seen.has(t))
                continue;
            seen.add(t);
            this.tokenDf.set(t, (this.tokenDf.get(t) ?? 0) + 1);
        }
    }
    sampleTexts() {
        return this.sampleMessages;
    }
    isPrimarilyKorean() {
        if (this.messageCount < 8)
            return true;
        if (this.corpusHangul < 24)
            return false;
        if (this.corpusLatin === 0)
            return true;
        return this.corpusHangul >= this.corpusLatin * 0.85;
    }
    toUserWords() {
        return [...this.tokenDf.entries()]
            .filter(([word, df]) => {
            const minDf = /[가-힣]/.test(word) ? 2 : 3;
            return df >= minDf;
        })
            .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
            .slice(0, 96)
            .map(([word, df]) => ({
            word,
            tag: /^[A-Za-z]/.test(word) ? "SL" : "NNP",
            score: Math.min(8, Math.log1p(df)),
        }));
    }
}
/** CSV 1회 읽기: 건수 + Kiwi 사용자 사전 후보 (레거시·벤치용) */
export async function runExportPrepass(filePath) {
    const collector = new HeuristicPrepassCollector();
    const sample = await readFileSample(filePath, SAMPLE_BYTES);
    const { encoding, skipBytes } = detectEncodingFromBytes(sample);
    const input = openDecodedStream(filePath, encoding, skipBytes, READ_HIGH_WATER_MARK);
    const rl = createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    let currentMessage = null;
    for await (const rawLine of rl) {
        lineNumber += 1;
        const line = rawLine.replace(/\r$/, "");
        if (lineNumber === 1) {
            parseHeaderLine(line, []);
            continue;
        }
        if (DATE_LINE_RE.test(line)) {
            if (currentMessage)
                collector.onMessageText(currentMessage);
            const started = parseRecordStart(line, lineNumber, []);
            currentMessage = started.message;
            continue;
        }
        if (currentMessage !== null) {
            currentMessage = `${currentMessage}\n${line}`;
        }
    }
    if (currentMessage)
        collector.onMessageText(currentMessage);
    return { messageCount: collector.messageCount, userWords: collector.toUserWords() };
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
//# sourceMappingURL=export-prepass.js.map