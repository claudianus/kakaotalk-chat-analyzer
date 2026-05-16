const MAX_MATRIX = 12;
function dyadKey(from, to) {
    return `${from}\t${to}`;
}
/** 스트리밍 응답 엣지 (직전 화자 → 현재 화자) */
export class DyadAccumulator {
    edges = new Map();
    totalReplies = 0;
    addReply(fromSender, toSender) {
        if (fromSender === toSender)
            return;
        const k = dyadKey(fromSender, toSender);
        this.edges.set(k, (this.edges.get(k) ?? 0) + 1);
        this.totalReplies += 1;
    }
    buildMatrix(participants, aliasBySender) {
        if (this.totalReplies < 3 || participants.length < 2)
            return null;
        const ranked = participants.slice(0, MAX_MATRIX);
        const senderByAlias = new Map();
        for (const [raw, alias] of aliasBySender)
            senderByAlias.set(alias, raw);
        const senders = ranked.map((p) => senderByAlias.get(p.alias) ?? p.alias);
        const aliases = ranked.map((p) => p.alias);
        const index = new Map(senders.map((s, i) => [s, i]));
        const matrix = aliases.map(() => aliases.map(() => 0));
        for (const [k, count] of this.edges) {
            const [from, to] = k.split("\t");
            const fi = index.get(from);
            const ti = index.get(to);
            if (fi === undefined || ti === undefined)
                continue;
            matrix[fi][ti] += count;
        }
        const topPairs = [...this.edges.entries()]
            .map(([k, replies]) => {
            const [from, to] = k.split("\t");
            return {
                fromAlias: aliasBySender.get(from) ?? from,
                toAlias: aliasBySender.get(to) ?? to,
                replies,
            };
        })
            .sort((a, b) => b.replies - a.replies)
            .slice(0, 8);
        return { aliases, matrix, topPairs, totalReplies: this.totalReplies };
    }
}
//# sourceMappingURL=dyad-matrix.js.map