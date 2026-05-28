export function buildRoomNarrative(input) {
    const paras = [];
    const { pace, insights: ins } = input;
    paras.push(`「${input.chatRoomName}」 — **${input.totalMessages.toLocaleString("ko-KR")}**건, **${input.participants}**명. 톤은 **${pace.emoji} ${pace.label}** — ${pace.detail}`);
    if (ins.participantGini !== null && ins.participantGini >= 0.65) {
        paras.push(`소수가 대화를 끌고 갑니다(지니 **${ins.participantGini}**, 상위 3명 **${ins.top3ParticipantSharePercent}%**). ${input.topDyadLabel ? `**${input.topDyadLabel}** 사이 응답이 잦고, 핵심 멤버끼리 대화가 이어집니다.` : "핵심 멤버끼리 대화가 이어집니다."}`);
    }
    else if (ins.participantGini !== null && ins.participantGini < 0.45) {
        paras.push(`참여가 고른 방입니다(지니 **${ins.participantGini}**). 화자 전환율 **${ins.speakerSwitchRatePer100}/100** — 여러 사람이 번갈아 말합니다.`);
    }
    if (input.topics.length > 0) {
        const t0 = input.topics[0];
        paras.push(`주제로는 **${t0.title}**(${t0.terms.slice(0, 4).join(" · ")})이 두드러집니다.`);
    }
    if (input.personas.length > 0) {
        const p = input.personas[0];
        paras.push(`멤버 성향 예시로 **${p.alias}**는 「${p.title}」 — ${p.reason}`);
    }
    const burst = input.events.filter((e) => e.kind === "burst");
    if (burst.length > 0) {
        paras.push(`**${burst[0].date}** 등 **${burst.length}**번의 급증일이 있습니다. 특정 날·이벤트에 대화가 몰립니다.`);
    }
    const og = `${input.chatRoomName}: ${pace.label}, ${input.totalMessages.toLocaleString("ko-KR")}건 · ${input.participants}명 · 리듬 ${ins.rhythmScore}/100`;
    return { ogSummary: og, paragraphs: paras.slice(0, 5) };
}
//# sourceMappingURL=room-narrative.js.map