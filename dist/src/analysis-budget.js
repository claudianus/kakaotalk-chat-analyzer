import { analysisBudgetMs, memoryHeadroomGb } from "./analysis-capability.js";
import { llmPhaseReserveMs } from "./llm-resolve.js";
const BASE_RESERVE_MS = {
    semantic: 120_000,
    sentiment: 90_000,
};
/** preset·가용 RAM에 따른 단계 예약 시간 */
export function phaseReserveMs(phase, preset, profile, llmSize) {
    const headroom = memoryHeadroomGb(profile);
    if (phase === "semantic") {
        if (preset === "quality" && headroom >= 16)
            return 70_000;
        if (preset === "quality" && headroom >= 12)
            return 85_000;
        if (headroom >= 16)
            return 80_000;
        if (headroom >= 12)
            return 95_000;
        return BASE_RESERVE_MS.semantic;
    }
    if (phase === "sentiment") {
        if (headroom >= 16)
            return 70_000;
        if (headroom >= 12)
            return 80_000;
        return BASE_RESERVE_MS.sentiment;
    }
    if (phase === "llm") {
        return llmPhaseReserveMs(llmSize, preset);
    }
    if (phase === "llm_retry") {
        return llmPhaseReserveMs("0.8B", preset);
    }
    return BASE_RESERVE_MS[phase];
}
/** 집계 시작 시각 + 예산으로 단계 skip 여부 */
export class AnalysisBudgetTracker {
    preset;
    profile;
    llmSize;
    budgetMs;
    started = performance.now();
    constructor(preset, messageCount, profile, llmSize) {
        this.preset = preset;
        this.profile = profile;
        this.llmSize = llmSize;
        this.budgetMs = analysisBudgetMs(preset, messageCount, profile);
    }
    /** LLM 직전 RAM 재프로브 후 예약 시간 갱신 */
    updateLlmSize(size) {
        this.llmSize = size;
    }
    remainingMs() {
        return Math.max(0, this.budgetMs - (performance.now() - this.started));
    }
    shouldSkip(phase) {
        const remain = this.remainingMs();
        let need = phaseReserveMs(phase, this.preset, this.profile, this.llmSize);
        if (phase === "semantic" &&
            this.preset === "quality" &&
            memoryHeadroomGb(this.profile) >= 14 &&
            remain >= 55_000 &&
            remain < need) {
            need = Math.max(50_000, remain - 8_000);
        }
        if (phase === "llm" &&
            this.llmSize &&
            (this.llmSize === "0.8B" || this.llmSize === "2B") &&
            remain >= 45_000 &&
            remain < need) {
            need = Math.max(40_000, remain - 5_000);
        }
        if (remain >= need)
            return false;
        process.stderr.write(`[kca] ${phase} 분석 건너뜀 (예산 ${Math.round(remain / 1000)}s 남음, 필요 ~${Math.round(need / 1000)}s)\n`);
        return true;
    }
}
//# sourceMappingURL=analysis-budget.js.map