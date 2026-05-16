/** 카카오톡 CSV 시스템 알림(키워드·본문 통계와 분리) */
export type SystemNoticeKind = "join" | "leave" | "deleted";
/** @deprecated join | leave 만 쓰는 호환 타입 */
export type RoomEventKind = "join" | "leave";
/** 키워드 토큰에서 제외할 시스템 알림 단어 */
export declare const ROOM_EVENT_KEYWORD_STOP: Set<string>;
export declare function detectSystemNotice(message: string): SystemNoticeKind | null;
export declare function detectRoomEvent(message: string): RoomEventKind | null;
export declare function isSystemNoticeMessage(message: string): boolean;
export declare function isRoomEventMessage(message: string): boolean;
