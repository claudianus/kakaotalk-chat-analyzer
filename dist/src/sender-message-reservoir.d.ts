/** 발신자와 함께 메시지 본문 균등 샘플(감정 분석용) */
export declare class SenderMessageReservoir {
    private cap;
    private buf;
    private seen;
    constructor(cap?: number);
    capacity(): number;
    growTo(newCap: number): void;
    push(text: string, sender: string): void;
    drain(): {
        text: string;
        sender: string;
    }[];
    size(): number;
}
