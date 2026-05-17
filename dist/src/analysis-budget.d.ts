import type { AnalysisPresetName } from "./analysis-preset.js";
import { type MachineProfile } from "./analysis-capability.js";
export type BudgetSkippablePhase = "semantic" | "sentiment" | "llm";
/** preset·가용 RAM에 따른 단계 예약 시간 */
export declare function phaseReserveMs(phase: BudgetSkippablePhase, preset: AnalysisPresetName, profile: MachineProfile): number;
/** 집계 시작 시각 + 예산으로 단계 skip 여부 */
export declare class AnalysisBudgetTracker {
    private readonly preset;
    private readonly profile;
    private readonly budgetMs;
    private readonly started;
    constructor(preset: AnalysisPresetName, messageCount: number, profile: MachineProfile);
    remainingMs(): number;
    shouldSkip(phase: BudgetSkippablePhase): boolean;
}
