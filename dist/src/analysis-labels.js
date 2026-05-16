import { basename } from "node:path";
const KAKAO_CHAT_PREFIX_RE = /^KakaoTalk_Chat_/i;
const KAKAO_PREFIX_RE = /^KakaoTalk_/i;
const EXPORT_TIMESTAMP_SUFFIX_RE = /_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/;
export function safeInputName(filePath) {
    const name = basename(filePath);
    return name.length > 80 ? `${name.slice(0, 77)}...` : name;
}
export function maskPartialDisplayName(raw) {
    const s = raw.trim();
    if (!s)
        return "?";
    const chars = [...s];
    if (chars.length === 1)
        return `${chars[0]}*`;
    if (chars.length === 2)
        return `${chars[0]}*`;
    const midLen = Math.min(chars.length - 2, 6);
    const middle = "*".repeat(Math.max(1, midLen));
    return `${chars[0]}${middle}${chars[chars.length - 1]}`;
}
export function parseChatRoomNameFromExportPath(filePath) {
    const base = basename(filePath).replace(/\.(csv|txt)$/i, "");
    let room = base;
    if (KAKAO_CHAT_PREFIX_RE.test(room)) {
        room = room.replace(KAKAO_CHAT_PREFIX_RE, "");
    }
    else if (KAKAO_PREFIX_RE.test(room)) {
        room = room.replace(KAKAO_PREFIX_RE, "");
    }
    room = room.replace(EXPORT_TIMESTAMP_SUFFIX_RE, "").trim();
    if (room.length > 0)
        return room.length > 120 ? `${room.slice(0, 117)}...` : room;
    const fallback = base.replace(EXPORT_TIMESTAMP_SUFFIX_RE, "").trim();
    return fallback.length > 0 ? fallback : "채팅방";
}
//# sourceMappingURL=analysis-labels.js.map