import type { ReportData, RoomEventStats } from "./types.js";

export interface OpenChatProfile {
  /** 오픈채팅·대규모 유입 방 추정 (휴리스틱) */
  likely: boolean;
  /** 0~1 신뢰도 근사 */
  score: number;
  joinLeaveSharePercent: number;
}

/** 입퇴장·운영 알림 비중으로 오픈채팅형 방 추정 */
export function inferOpenChatProfile(
  roomEvents: RoomEventStats,
  totalMessages: number,
): OpenChatProfile {
  if (totalMessages < 30) {
    return { likely: false, score: 0, joinLeaveSharePercent: 0 };
  }
  const joinLeave = roomEvents.joinCount + roomEvents.leaveCount;
  const joinLeaveShare = (joinLeave / totalMessages) * 100;
  const systemShare = (roomEvents.total / totalMessages) * 100;
  const shopSignal = roomEvents.shopSearchCount > 0 ? 0.15 : 0;
  const score = Math.min(
    1,
    joinLeaveShare / 12 + systemShare / 40 + shopSignal,
  );
  return {
    likely: score >= 0.45 || joinLeaveShare >= 8,
    score: Math.round(score * 100) / 100,
    joinLeaveSharePercent: Math.round(joinLeaveShare * 10) / 10,
  };
}

export function openChatProfileFromReport(data: ReportData): OpenChatProfile {
  return inferOpenChatProfile(data.roomEvents, data.summary.totalMessages);
}
