import { KOREAN_CHAT_STOPWORDS, MORPHOLOGICAL_FRAGMENTS } from "./korean-stopwords.js";
import { SYSTEM_NOTICE_KEYWORD_STOP } from "./system-notices.js";
const ATTACHMENT_STOP = [
    "사진",
    "동영상",
    "파일",
    "이모티콘",
    "지도",
    "연락처",
    "투표",
    "공유",
    "음성메시지",
    "삭제된 메시지",
];
export function buildKeywordStopwords() {
    const s = new Set([
        ...KOREAN_CHAT_STOPWORDS,
        ...MORPHOLOGICAL_FRAGMENTS,
        ...SYSTEM_NOTICE_KEYWORD_STOP,
        ...ATTACHMENT_STOP,
    ]);
    return s;
}
//# sourceMappingURL=keyword-stopwords.js.map