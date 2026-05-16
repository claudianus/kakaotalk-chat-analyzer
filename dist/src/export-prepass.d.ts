import type { UserWord } from "kiwi-nlp";
export interface ExportPrepassResult {
    messageCount: number;
    userWords: UserWord[];
}
/** 스트리밍 분석과 함께 쓰는 휴리스틱 userWords·건수 수집 */
export declare class HeuristicPrepassCollector {
    private readonly tokenDf;
    private readonly sampleMessages;
    private readonly maxSamples;
    private corpusHangul;
    private corpusLatin;
    messageCount: number;
    onMessageText(message: string): void;
    sampleTexts(): string[];
    isPrimarilyKorean(): boolean;
    toUserWords(): UserWord[];
}
/** CSV 1회 읽기: 건수 + Kiwi 사용자 사전 후보 (레거시·벤치용) */
export declare function runExportPrepass(filePath: string): Promise<ExportPrepassResult>;
