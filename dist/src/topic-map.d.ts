import type { ReportTopic } from "./types.js";
/** 스트리밍 주제 맵: 공기 그래프 군집 + 월별 c-TF-IDF */
export declare class TopicMapAccumulator {
    private readonly cooc;
    private readonly tokenDocFreq;
    private readonly monthlyTf;
    private readonly monthlyMessages;
    private messages;
    addMessage(tokens: string[], monthKey: string): void;
    buildTopics(totalMessages: number, stopwords: ReadonlySet<string>): ReportTopic[];
    private buildCooccurrenceThemes;
    private buildMonthlyPeriods;
}
