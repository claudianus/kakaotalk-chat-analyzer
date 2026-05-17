import { analysisBudgetMs } from "./analysis-capability.js";
const PHASE_RESERVE_MS = {
    semantic: 120_000,
    sentiment: 90_000,
    llm: 50_000,
};
/** 집계 시작 시각 + 예산으로 단계 skip 여부 */
export class AnalysisBudgetTracker {
    budgetMs;
    started = performance.now();
    constructor(preset, messageCount, profile) {
        this.budgetMs = analysisBudgetMs(preset, messageCount, profile);
    }
    remainingMs() {
        return Math.max(0, this.budgetMs - (performance.now() - this.started));
    }
    shouldSkip(phase) {
        const need = PHASE_RESERVE_MS[phase];
        const remain = this.remainingMs();
        if (remain >= need)
            return false;
        process.stderr.write(`[kca] ${phase} 분석 건너뜀 (예산 ${Math.round(remain / 1000)}s 남음, 필요 ~${Math.round(need / 1000)}s)\n`);
        return true;
    }
}
//# sourceMappingURL=analysis-budget.js.map