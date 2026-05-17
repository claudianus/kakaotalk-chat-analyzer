export interface KeywordRankItem {
  label: string;
  /** BM25 상대 점수 */
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
export function adaptiveMinCount(messageCount: number, koreanPrimary = true): number {
  let min: number;
  if (messageCount < 200) min = 2;
  else if (messageCount < 2_000) min = 3;
  else if (messageCount < 100_000) min = 4;
  else min = 5;
  if (koreanPrimary && messageCount >= 50_000 && min > 4) return 4;
  if (koreanPrimary && messageCount < 8_000 && min > 2) return min - 1;
  return min;
}
