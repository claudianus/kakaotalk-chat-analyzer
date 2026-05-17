/** 메시지 본문 균등 샘플(시맨틱 키워드·임베딩용) */
export declare class MessageReservoir {
    private cap;
    private buf;
    private seen;
    constructor(cap?: number);
    capacity(): number;
    growTo(newCap: number): void;
    push(message: string): void;
    drain(): string[];
    size(): number;
}
