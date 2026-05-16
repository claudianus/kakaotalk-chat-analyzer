/** 메시지 본문 균등 샘플(시맨틱 키워드·임베딩용) */
export declare class MessageReservoir {
    private readonly cap;
    private buf;
    private seen;
    constructor(cap?: number);
    push(message: string): void;
    drain(): string[];
    size(): number;
}
