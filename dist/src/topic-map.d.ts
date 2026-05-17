import type { ReportTopic } from "./types.js";
/** graph 레인 상한 — 최종 slice는 topic-merge */
export declare const MAX_GRAPH_TOPICS = 12;
/** 스트리밍 주제 맵: 공기 그래프 군집 + 월별 c-TF-IDF */
export declare class TopicMapAccumulator {
    private readonly cooc;
    private readonly tokenDocFreq;
    private readonly monthlyTf;
    private readonly monthlyMessages;
    private messages;
    addMessage(tokens: string[], monthKey: string): void;
    buildTopics(totalMessages: number, stopwords: ReadonlySet<string>): ReportTopic[];
    /** 키워드 시드용 공기 이웃 */
    getCooccurrenceNeighbors(label: string, limit?: number): string[];
    private buildCooccurrenceThemes;
    private buildMonthlyPeriods;
}
