const MAX_GAP_MS = 7 * 24 * 60 * 60 * 1000;
const LOG_MIN = Math.log(1000);
const LOG_MAX = Math.log(MAX_GAP_MS);
const BUCKET_COUNT = 64;
/** 이 개수 이상이면 백분위는 저장된 간격 배열로 정확 계산 */
const EXACT_QUANTILE_MIN = 50_000;
const EXACT_STORE_MAX = 120_000;

/** 메시지 간격(ms) 스트리밍 통계 — 소규모는 64-bin, 대용량은 exact quantile */
export class GapStreamStats {
  private count = 0;
  private burstUnder1m = 0;
  private gapOver60m = 0;
  private readonly histogram = new Uint32Array(BUCKET_COUNT);
  private readonly exact: number[] = [];
  private welfordN = 0;
  private welfordMean = 0;
  private welfordM2 = 0;

  add(deltaMs: number): void {
    if (deltaMs <= 0 || deltaMs > MAX_GAP_MS) return;
    this.count += 1;
    if (deltaMs < 60_000) this.burstUnder1m += 1;
    if (deltaMs > 3_600_000) this.gapOver60m += 1;

    if (this.exact.length < EXACT_STORE_MAX) {
      this.exact.push(deltaMs);
    }

    const clamped = Math.max(1000, Math.min(deltaMs, MAX_GAP_MS));
    const log = Math.log(clamped);
    const idx = Math.min(
      BUCKET_COUNT - 1,
      Math.floor(((log - LOG_MIN) / (LOG_MAX - LOG_MIN)) * BUCKET_COUNT),
    );
    this.histogram[idx] = (this.histogram[idx] ?? 0) + 1;

    this.welfordN += 1;
    const d = deltaMs - this.welfordMean;
    this.welfordMean += d / this.welfordN;
    this.welfordM2 += d * (deltaMs - this.welfordMean);
  }

  get size(): number {
    return this.count;
  }

  medianMs(): number | null {
    return this.quantileMs(0.5);
  }

  p90Ms(): number | null {
    return this.quantileMs(0.9);
  }

  burstUnder1mPercent(): number | null {
    if (this.count === 0) return null;
    return round((this.burstUnder1m / this.count) * 100, 1);
  }

  gapOver60mPercent(): number | null {
    if (this.count === 0) return null;
    return round((this.gapOver60m / this.count) * 100, 1);
  }

  coeffVariation(): number | null {
    if (this.welfordN < 2 || this.welfordMean <= 0) return null;
    const variance = this.welfordM2 / this.welfordN;
    return round(Math.sqrt(variance) / this.welfordMean, 2);
  }

  private quantileMs(p: number): number | null {
    if (this.count === 0) return null;
    if (this.exact.length >= EXACT_QUANTILE_MIN && this.count <= EXACT_STORE_MAX) {
      return exactQuantileMs(this.exact, p);
    }
    return histogramQuantileMs(this.histogram, this.count, p);
  }
}

function exactQuantileMs(source: number[], p: number): number {
  const sorted = [...source].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx] ?? MAX_GAP_MS;
}

function histogramQuantileMs(histogram: Uint32Array, count: number, p: number): number | null {
  const target = count * p;
  let acc = 0;
  for (let i = 0; i < BUCKET_COUNT; i += 1) {
    acc += histogram[i] ?? 0;
    if (acc >= target) {
      const centerLog = LOG_MIN + ((i + 0.5) / BUCKET_COUNT) * (LOG_MAX - LOG_MIN);
      return Math.exp(centerLog);
    }
  }
  return MAX_GAP_MS;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** 30분 이상 침묵이면 새 대화 세션으로 분리 */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface SessionGapSnapshot {
  sessionCount: number;
  avgMessagesPerSession: number | null;
  medianSessionMinutes: number | null;
}

export class SessionGapStats {
  private sessionCount = 0;
  private currentMessages = 0;
  private readonly messageCounts: number[] = [];
  private readonly durationMs: number[] = [];
  private sessionStartMs: number | null = null;
  private lastMs: number | null = null;

  addMessage(ms: number): void {
    if (this.lastMs === null) {
      this.openSession(ms);
    } else {
      const delta = ms - this.lastMs;
      if (delta > SESSION_IDLE_MS) {
        this.closeSession();
        this.openSession(ms);
      }
    }
    this.currentMessages += 1;
    this.lastMs = ms;
  }

  finalize(): SessionGapSnapshot {
    this.closeSession();
    return {
      sessionCount: this.sessionCount,
      avgMessagesPerSession:
        this.messageCounts.length > 0
          ? round(
              this.messageCounts.reduce((a, b) => a + b, 0) / this.messageCounts.length,
              1,
            )
          : null,
      medianSessionMinutes:
        this.durationMs.length > 0
          ? round(medianSorted(this.durationMs) / 60_000, 1)
          : null,
    };
  }

  private openSession(ms: number): void {
    this.sessionCount += 1;
    this.currentMessages = 0;
    this.sessionStartMs = ms;
  }

  private closeSession(): void {
    if (this.currentMessages > 0) this.messageCounts.push(this.currentMessages);
    if (this.sessionStartMs !== null && this.lastMs !== null && this.lastMs >= this.sessionStartMs) {
      this.durationMs.push(this.lastMs - this.sessionStartMs);
    }
    this.currentMessages = 0;
    this.sessionStartMs = null;
  }
}

function medianSorted(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}
