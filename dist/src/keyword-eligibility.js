const ATTACHMENT_MARKERS = [
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
const PHOTO_BUNDLE_RE = /^사진\s+\d+\s*장$/;
export function shouldExtractKeywords(message, attachmentMarkers) {
    const trimmed = message.trim();
    if (trimmed.length === 0)
        return false;
    if (attachmentMarkers.length === 1 && trimmed === attachmentMarkers[0])
        return false;
    if (attachmentMarkers.length > 0 && trimmed.length <= 16) {
        const onlyMarkers = attachmentMarkers.every((m) => trimmed === m || trimmed.includes(m));
        if (onlyMarkers && !/[가-힣A-Za-z]{3,}/.test(trimmed.replace(/[^\p{L}\p{N}]/gu, ""))) {
            return false;
        }
    }
    return true;
}
export function getAttachmentMarkers(message) {
    const found = ATTACHMENT_MARKERS.filter((marker) => message.includes(marker));
    const t = message.trim();
    if (PHOTO_BUNDLE_RE.test(t) && !found.includes("사진")) {
        found.push("사진");
    }
    return found;
}
//# sourceMappingURL=keyword-eligibility.js.map