import type { AnalysisPresetName } from "./analysis-preset.js";
import { analysisBudgetMs, type MachineProfile } from "./analysis-capability.js";

export type BudgetSkippablePhase = "semantic" | "sentiment" | "llm";

const PHASE_RESERVE_MS: Record<BudgetSkippablePhase, number> = {
  semantic: 120_000,
  sentiment: 90_000,
  llm: 50_000,
};

/** 집계 시작 시각 + 예산으로 단계 skip 여부 */
export class AnalysisBudgetTracker {
  private readonly budgetMs: number;
  private readonly started = performance.now();

  constructor(preset: AnalysisPresetName, messageCount: number, profile: MachineProfile) {
    this.budgetMs = analysisBudgetMs(preset, messageCount, profile);
  }

  remainingMs(): number {
    return Math.max(0, this.budgetMs - (performance.now() - this.started));
  }

  shouldSkip(phase: BudgetSkippablePhase): boolean {
    const need = PHASE_RESERVE_MS[phase];
    const remain = this.remainingMs();
    if (remain >= need) return false;
    process.stderr.write(
      `[kca] ${phase} 분석 건너뜀 (예산 ${Math.round(remain / 1000)}s 남음, 필요 ~${Math.round(need / 1000)}s)\n`,
    );
    return true;
  }
}
