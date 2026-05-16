export interface StreamParseOptions {
  /** N건마다 onProgress 호출 (기본 25_000) */
  progressEvery?: number;
  onProgress?: (count: number) => void;
  /** YYYY-MM-DD — 이 날짜 이후만 집계 */
  since?: string;
}
