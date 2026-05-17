import type { InteractionDyad, InteractionMatrix, ParticipantStat } from "./types.js";

const MAX_MATRIX = 12;

function dyadKey(from: string, to: string): string {
  return `${from}\t${to}`;
}

/** 스트리밍 응답 엣지 (직전 화자 → 현재 화자) */
export class DyadAccumulator {
  private readonly edges = new Map<string, number>();
  private totalReplies = 0;

  addReply(fromSender: string, toSender: string): void {
    if (fromSender === toSender) return;
    const k = dyadKey(fromSender, toSender);
    this.edges.set(k, (this.edges.get(k) ?? 0) + 1);
    this.totalReplies += 1;
  }

  buildMatrix(
    participants: ParticipantStat[],
    aliasBySender: Map<string, string>,
  ): InteractionMatrix | null {
    if (this.totalReplies < 3 || participants.length < 2) return null;

    const ranked = [...participants]
      .sort((a, b) => b.messages - a.messages || a.alias.localeCompare(b.alias))
      .slice(0, MAX_MATRIX);
    const senderByAlias = new Map<string, string>();
    for (const [raw, alias] of aliasBySender) senderByAlias.set(alias, raw);
    const senders = ranked.map((p) => senderByAlias.get(p.alias) ?? p.alias);

    const aliases = ranked.map((p) => p.alias);
    const messageCounts = ranked.map((p) => p.messages);
    const index = new Map(senders.map((s, i) => [s, i]));
    const matrix = aliases.map(() => aliases.map(() => 0));

    for (const [k, count] of this.edges) {
      const [from, to] = k.split("\t");
      const fi = index.get(from);
      const ti = index.get(to);
      if (fi === undefined || ti === undefined) continue;
      matrix[fi]![ti]! += count;
    }

    const topPairs: InteractionDyad[] = [...this.edges.entries()]
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

    return { aliases, matrix, topPairs, totalReplies: this.totalReplies, messageCounts };
  }
}
