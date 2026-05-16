/** 메시지 본문 균등 샘플(시맨틱 키워드·임베딩용) */
export class MessageReservoir {
  private readonly cap: number;
  private buf: string[] = [];
  private seen = 0;

  constructor(cap = 480) {
    this.cap = cap;
  }

  push(message: string): void {
    this.seen += 1;
    if (this.buf.length < this.cap) {
      this.buf.push(message);
      return;
    }
    const j = Math.floor(Math.random() * this.seen);
    if (j < this.cap) this.buf[j] = message;
  }

  drain(): string[] {
    const out = this.buf;
    this.buf = [];
    this.seen = 0;
    return out;
  }

  size(): number {
    return this.buf.length;
  }
}
