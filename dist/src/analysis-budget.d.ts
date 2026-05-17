import type { AnalysisPresetName } from "./analysis-preset.js";
import { type MachineProfile } from "./analysis-capability.js";
export type BudgetSkippablePhase = "semantic" | "sentiment" | "llm";
/** 집계 시작 시각 + 예산으로 단계 skip 여부 */
export declare class AnalysisBudgetTracker {
    private readonly budgetMs;
    private readonly started;
    constructor(preset: AnalysisPresetName, messageCount: number, profile: MachineProfile);
    remainingMs(): number;
    shouldSkip(phase: BudgetSkippablePhase): boolean;
}
