/** 입퇴장·운영 알림 비중으로 오픈채팅형 방 추정 */
export function inferOpenChatProfile(roomEvents, totalMessages) {
    if (totalMessages < 30) {
        return { likely: false, score: 0, joinLeaveSharePercent: 0 };
    }
    const joinLeave = roomEvents.joinCount + roomEvents.leaveCount;
    const joinLeaveShare = (joinLeave / totalMessages) * 100;
    const systemShare = (roomEvents.total / totalMessages) * 100;
    const shopSignal = roomEvents.shopSearchCount > 0 ? 0.15 : 0;
    const score = Math.min(1, joinLeaveShare / 12 + systemShare / 40 + shopSignal);
    return {
        likely: score >= 0.45 || joinLeaveShare >= 8,
        score: Math.round(score * 100) / 100,
        joinLeaveSharePercent: Math.round(joinLeaveShare * 10) / 10,
    };
}
export function openChatProfileFromReport(data) {
    return inferOpenChatProfile(data.roomEvents, data.summary.totalMessages);
}
//# sourceMappingURL=open-chat-profile.js.map