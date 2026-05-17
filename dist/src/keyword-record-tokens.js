import { getAttachmentMarkers, shouldExtractKeywords } from "./keyword-eligibility.js";
import { isOpenChatBoilerplate, splitMessageForAnalysis } from "./system-notices.js";
import { tokenizeForKeywords } from "./keyword-tokenize.js";
const HAS_TOKEN_CHAR_RE = /[가-힣A-Za-z]/;
function pad2(value) {
    return value < 10 ? `0${value}` : String(value);
}
/** consumeKeywords와 동일 필터·토큰화 (worker pool·단일 스레드 공용) */
export function keywordTokensForRecord(record) {
    const split = splitMessageForAnalysis(record.message);
    const msg = split.userText.length > 0 ? split.userText : record.message;
    const messageLength = msg.length;
    if (split.notices.length > 0 && split.userText.length === 0)
        return null;
    const foundAttachments = getAttachmentMarkers(msg);
    if (isOpenChatBoilerplate(msg))
        return null;
    if (messageLength < 2 || !HAS_TOKEN_CHAR_RE.test(msg) || !shouldExtractKeywords(msg, foundAttachments)) {
        return null;
    }
    const tokens = tokenizeForKeywords(msg);
    const monthKey = `${record.date.year}-${pad2(record.date.month)}`;
    return { tokens, monthKey };
}
//# sourceMappingURL=keyword-record-tokens.js.map