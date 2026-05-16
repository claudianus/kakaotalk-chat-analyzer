const MAX_ENTRIES = 4000;
const PRUNE_TO = 2500;
/** 동일 본문 반복(환영문·카피페asta) — 상한 맵 */
export class RepeatPhraseCounter {
    map = new Map();
    add(text) {
        const n = text.trim().replace(/\s+/g, " ");
        if (n.length < 12 || n.length > 180)
            return;
        this.map.set(n, (this.map.get(n) ?? 0) + 1);
        if (this.map.size > MAX_ENTRIES)
            this.prune();
    }
    top(limit, minCount) {
        return [...this.map.entries()]
            .filter(([, c]) => c >= minCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([label, count]) => ({
            label: label.length > 72 ? `${label.slice(0, 69)}…` : label,
            count,
        }));
    }
    prune() {
        const kept = [...this.map.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, PRUNE_TO);
        this.map.clear();
        for (const [k, v] of kept)
            this.map.set(k, v);
    }
}
//# sourceMappingURL=repeat-phrase-counter.js.map