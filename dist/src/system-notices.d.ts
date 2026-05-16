/** 카카오톡 CSV 시스템·운영 알림 (본문 키워드와 분리 집계) */
export type SystemNoticeKind = "join" | "leave" | "deleted" | "hidden" | "kick" | "slowModeOn" | "slowModeOff" | "subManager" | "manager" | "shopSearch" | "photoBundle";
/** @deprecated */
export type RoomEventKind = "join" | "leave";
export declare const SYSTEM_NOTICE_KEYWORD_STOP: Set<string>;
/** 오픈채팅 환영·규칙 복붙 문구 — 키워드·반복 문구에서 제외 */
export declare function isOpenChatBoilerplate(text: string): boolean;
/** @deprecated */
export declare const ROOM_EVENT_KEYWORD_STOP: Set<string>;
export declare function normalizeNoticeLine(line: string): string;
export declare function detectSystemNoticeLine(line: string): SystemNoticeKind | null;
/** @deprecated */
export declare function detectSystemNotice(message: string): SystemNoticeKind | null;
export declare function detectRoomEvent(message: string): RoomEventKind | null;
export declare function isSystemNoticeMessage(message: string): boolean;
export declare function isRoomEventMessage(message: string): boolean;
export interface MessageAnalysisSplit {
    /** 키워드·본문 통계에 쓸 사용자 텍스트 */
    userText: string;
    notices: SystemNoticeKind[];
    shopSearchTags: string[];
}
export declare function extractShopSearchTag(line: string): string | null;
/** 멀티라인·CSV 꼬리에서 시스템 알림 분리 */
export declare function splitMessageForAnalysis(message: string): MessageAnalysisSplit;
export declare const SYSTEM_NOTICE_LABELS: Record<SystemNoticeKind, string>;
