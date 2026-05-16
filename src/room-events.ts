/** 카카오톡 CSV 시스템 알림(키워드·본문 통계와 분리) */
export type SystemNoticeKind = "join" | "leave" | "deleted";

/** @deprecated join | leave 만 쓰는 호환 타입 */
export type RoomEventKind = "join" | "leave";

const JOIN_LINE =
  /^(?:.+님이\s*)?들어왔습니다\.?$|^.+님이\s+들어왔습니다\.?$/u;
const LEAVE_LINE =
  /^(?:.+님이\s*)?나갔습니다\.?$|^.+님이\s+나갔습니다\.?$/u;
const DELETED_LINE = /^(?:.+?\s+)?메시지가\s+삭제되었습니다\.?$/u;

/** 키워드 토큰에서 제외할 시스템 알림 단어 */
export const ROOM_EVENT_KEYWORD_STOP = new Set([
  "들어왔습니다",
  "나갔습니다",
  "삭제되었습니다",
  "메시지가",
]);

export function detectSystemNotice(message: string): SystemNoticeKind | null {
  const t = message.trim().replace(/\s+/g, " ");
  if (!t) return null;
  if (DELETED_LINE.test(t)) return "deleted";
  if (LEAVE_LINE.test(t)) return "leave";
  if (JOIN_LINE.test(t)) return "join";
  return null;
}

export function detectRoomEvent(message: string): RoomEventKind | null {
  const kind = detectSystemNotice(message);
  if (kind === "join" || kind === "leave") return kind;
  return null;
}

export function isSystemNoticeMessage(message: string): boolean {
  return detectSystemNotice(message) !== null;
}

export function isRoomEventMessage(message: string): boolean {
  return isSystemNoticeMessage(message);
}
