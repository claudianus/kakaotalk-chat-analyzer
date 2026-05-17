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
        if (this.buf.length < this.cap) {
            this.buf.push({ text, sender });
            return;
        }
        const j = Math.floor(Math.random() * this.seen);
        if (j < this.cap)
            this.buf[j] = { text, sender };
    }
    drain() {
        const out = this.buf;
        this.buf = [];
        this.seen = 0;
        return out;
    }
    size() {
        return this.buf.length;
    }
}
//# sourceMappingURL=sender-message-reservoir.js.map