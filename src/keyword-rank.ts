export interface KeywordRankItem {
  label: string;
  /** TF-IDF 상대 점수 */
  score: number;
  /** 해당 표현이 등장한 메시지 수 */
  messageHits: number;
}

export interface KeywordExtractOptions {
  stopwords?: ReadonlySet<string>;
  limit?: number;
  minDocFreq?: number;
}

/** 메시지 수에 따른 최소 문서 빈도 */
export function adaptiveMinCount(messageCount: number): number {
  if (messageCount < 200) return 2;
  if (messageCount < 2_000) return 3;
  if (messageCount < 100_000) return 4;
  return 5;
}
