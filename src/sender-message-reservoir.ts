/** 발신자와 함께 메시지 본문 균등 샘플(감정 분석용) */
export class SenderMessageReservoir {
  private cap: number;
  private buf: { text: string; sender: string }[] = [];
  private seen = 0;

  constructor(cap = 480) {
    this.cap = cap;
  }

  capacity(): number {
    return this.cap;
  }

  growTo(newCap: number): void {
    if (newCap <= this.cap) return;
    if (this.seen > this.cap) return;
    this.cap = newCap;
  }

  push(text: string, sender: string): void {
    this.seen += 1;
    if (this.buf.length < this.cap) {
      this.buf.push({ text, sender });
      return;
    }
    const j = Math.floor(Math.random() * this.seen);
    if (j < this.cap) this.buf[j] = { text, sender };
  }

  drain(): { text: string; sender: string }[] {
    const out = this.buf;
    this.buf = [];
    this.seen = 0;
    return out;
  }

  size(): number {
    return this.buf.length;
  }
}
