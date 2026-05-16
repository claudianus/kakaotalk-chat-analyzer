export interface StreamParseOptions {
  /** N건마다 onProgress 호출 (기본 25_000) */
  progressEvery?: number;
  onProgress?: (count: number) => void;
}
