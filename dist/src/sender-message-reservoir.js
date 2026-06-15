import { hashString } from "./deterministic-random.js";
/** 발신자와 함께 메시지 본문 균등 샘플(감정 분석용) */
export class SenderMessageReservoir {
    cap;
    buf = [];
    seen = 0;
    constructor(cap = 480) {
        this.cap = cap;
    }
    capacity() {
        return this.cap;
    }
    growTo(newCap) {
        if (newCap <= this.cap)
            return;
        this.cap = newCap;
    }
    push(text, sender) {
        this.seen += 1;
        const index = this.seen - 1;
        const score = hashString(`${index}\u0000${sender}\u0000${text}`);
        if (this.buf.length < this.cap) {
            this.buf.push({ text, sender, score, index });
            return;
        }
        let maxIdx = 0;
        for (let i = 1; i < this.buf.length; i += 1) {
            const cur = this.buf[i];
            const max = this.buf[maxIdx];
            if (cur.score > max.score || (cur.score === max.score && cur.index > max.index))
                maxIdx = i;
        }
        const max = this.buf[maxIdx];
        if (score < max.score || (score === max.score && index < max.index)) {
            this.buf[maxIdx] = { text, sender, score, index };
        }
    }
    drain() {
        const out = this.buf
            .slice()
            .sort((a, b) => a.index - b.index)
            .map(({ text, sender }) => ({ text, sender }));
        this.buf = [];
        this.seen = 0;
        return out;
    }
    size() {
        return this.buf.length;
    }
}
//# sourceMappingURL=sender-message-reservoir.js.map