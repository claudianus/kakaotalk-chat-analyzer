export function buildRoomNarrative(input) {
    const paras = [];
    const { pace, insights: ins } = input;
    paras.push(`「${input.chatRoomName}」은 총 **${input.totalMessages.toLocaleString("ko-KR")}**건의 메시지, **${input.participants}**명이 참여한 대화 공간으로 읽힙니다. 전체 톤은 **${pace.emoji} ${pace.label}** — ${pace.detail}`);
    if (ins.participantGini !== null && ins.participantGini >= 0.65) {
        paras.push(`참여는 소수에게 몰리는 편입니다(지니 **${ins.participantGini}**, 상위 3명 **${ins.top3ParticipantSharePercent}%**). ${input.topDyadLabel ? `특히 **${input.topDyadLabel}** 사이 응답이 잦아, 핵심 멤버끼리 대화가 이어지는 구조로 보입니다.` : "핵심 멤버끼리 대화가 이어지는 구조로 보입니다."}`);
    }
    else if (ins.participantGini !== null && ins.participantGini < 0.45) {
        paras.push(`참여가 비교적 고른 방입니다(지니 **${ins.participantGini}**). 여러 사람이 번갈아 말하는 **${ins.speakerSwitchRatePer100}/100** 화자 전환율과 맞물립니다.`);
    }
    if (input.topics.length > 0) {
        const t0 = input.topics[0];
        paras.push(`주제 신호상 **${t0.title}**(${t0.terms.slice(0, 4).join(" · ")})가 두드러지며, 대화의 중심 축 중 하나로 보입니다.`);
    }
    if (input.personas.length > 0) {
        const p = input.personas[0];
        paras.push(`멤버 성향 예시로 **${p.alias}**는 「${p.title}」 — ${p.reason}`);
    }
    const burst = input.events.filter((e) => e.kind === "burst");
    if (burst.length > 0) {
        paras.push(`시간축에서는 **${burst[0].date}** 등 **${burst.length}**번의 급증일이 있어, 특정 날·이벤트에 대화가 몰리는 패턴이 있습니다.`);
    }
    const og = `${input.chatRoomName}: ${pace.label}, ${input.totalMessages.toLocaleString("ko-KR")}건 · ${input.participants}명 · 리듬 ${ins.rhythmScore}/100`;
    return { ogSummary: og, paragraphs: paras.slice(0, 5) };
}
//# sourceMappingURL=room-narrative.js.map