import { TextDecoder } from "node:util";
import iconv from "iconv-lite";
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
export function decodeChatExport(bytes) {
    if (bytes.subarray(0, 3).equals(UTF8_BOM)) {
        return {
            encoding: "utf-8-bom",
            text: bytes.subarray(3).toString("utf8"),
        };
    }
    const candidates = [];
    const utf8 = decodeUtf8(bytes);
    if (utf8) {
        candidates.push({ encoding: "utf-8", text: utf8, score: scoreDecodedText(utf8) });
    }
    for (const encoding of ["cp949", "euc-kr"]) {
        const text = iconv.decode(bytes, encoding);
        candidates.push({ encoding, text, score: scoreDecodedText(text) });
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) {
        throw new Error("Unable to decode file with utf-8, cp949, or euc-kr.");
    }
    return { encoding: best.encoding, text: stripBom(best.text) };
}
function decodeUtf8(bytes) {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        return null;
    }
}
function stripBom(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
function scoreDecodedText(text) {
    const sample = text.slice(0, 128 * 1024);
    let score = 0;
    if (/^Date,User,Message\b/m.test(sample))
        score += 1000;
    if (/^날짜,/.test(sample))
        score += 500;
    const dateMatches = sample.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},/gm)?.length ?? 0;
    score += dateMatches * 10;
    const replacementChars = (sample.match(/\uFFFD/g) ?? []).length;
    score -= replacementChars * 50;
    const hangulChars = (sample.match(/[가-힣]/g) ?? []).length;
    score += Math.min(hangulChars, 500);
    return score;
}
//# sourceMappingURL=encoding.js.map