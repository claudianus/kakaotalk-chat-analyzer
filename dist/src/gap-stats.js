const MAX_GAP_MS = 7 * 24 * 60 * 60 * 1000;
const LOG_MIN = Math.log(1000);
const LOG_MAX = Math.log(MAX_GAP_MS);
const BUCKET_COUNT = 64;
/** 이 개수 이상이면 백분위는 저장된 간격 배열로 정확 계산 */
const EXACT_QUANTILE_MIN = 50_000;
const EXACT_STORE_MAX = 120_000;
/** 메시지 간격(ms) 스트리밍 통계 — 소규모는 64-bin, 대용량은 exact quantile */
export class GapStreamStats {
    count = 0;
    burstUnder1m = 0;
    gapOver60m = 0;
    histogram = new Uint32Array(BUCKET_COUNT);
    exact = [];
    welfordN = 0;
    welfordMean = 0;
    welfordM2 = 0;
    add(deltaMs) {
        if (deltaMs <= 0 || deltaMs > MAX_GAP_MS)
            return;
        this.count += 1;
        if (deltaMs < 60_000)
            this.burstUnder1m += 1;
        if (deltaMs > 3_600_000)
            this.gapOver60m += 1;
        if (this.exact.length < EXACT_STORE_MAX) {
            this.exact.push(deltaMs);
        }
        const clamped = Math.max(1000, Math.min(deltaMs, MAX_GAP_MS));
        const log = Math.log(clamped);
        const idx = Math.min(BUCKET_COUNT - 1, Math.floor(((log - LOG_MIN) / (LOG_MAX - LOG_MIN)) * BUCKET_COUNT));
        this.histogram[idx] = (this.histogram[idx] ?? 0) + 1;
        this.welfordN += 1;
        const d = deltaMs - this.welfordMean;
        this.welfordMean += d / this.welfordN;
        this.welfordM2 += d * (deltaMs - this.welfordMean);
    }
    get size() {
        return this.count;
    }
    medianMs() {
        return this.quantileMs(0.5);
    }
    p90Ms() {
        return this.quantileMs(0.9);
    }
    burstUnder1mPercent() {
        if (this.count === 0)
            return null;
        return round((this.burstUnder1m / this.count) * 100, 1);
    }
    gapOver60mPercent() {
        if (this.count === 0)
            return null;
        return round((this.gapOver60m / this.count) * 100, 1);
    }
    coeffVariation() {
        if (this.welfordN < 2 || this.welfordMean <= 0)
            return null;
        const variance = this.welfordM2 / this.welfordN;
        return round(Math.sqrt(variance) / this.welfordMean, 2);
    }
    quantileMs(p) {
        if (this.count === 0)
            return null;
        if (this.exact.length >= EXACT_QUANTILE_MIN && this.count <= EXACT_STORE_MAX) {
            return exactQuantileMs(this.exact, p);
        }
        return histogramQuantileMs(this.histogram, this.count, p);
    }
}
function exactQuantileMs(source, p) {
    const sorted = [...source].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
    return sorted[idx] ?? MAX_GAP_MS;
}
function histogramQuantileMs(histogram, count, p) {
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
function round(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
//# sourceMappingURL=gap-stats.js.map