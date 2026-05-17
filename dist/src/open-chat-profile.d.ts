import type { ReportData, RoomEventStats } from "./types.js";
export interface OpenChatProfile {
    /** 오픈채팅·대규모 유입 방 추정 (휴리스틱) */
    likely: boolean;
    /** 0~1 신뢰도 근사 */
    score: number;
    joinLeaveSharePercent: number;
}
/** 입퇴장·운영 알림 비중으로 오픈채팅형 방 추정 */
export declare function inferOpenChatProfile(roomEvents: RoomEventStats, totalMessages: number): OpenChatProfile;
export declare function openChatProfileFromReport(data: ReportData): OpenChatProfile;
