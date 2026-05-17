import type { BuildReportOptions } from "./analyze-pool.js";
import { type MachineProfile } from "./analysis-capability.js";
import type { AnalysisProfile } from "./analysis-profile.js";
export type AnalysisPresetName = "speed" | "balanced" | "quality" | "custom";
export interface PresetEffectiveFlags {
    preset: AnalysisPresetName;
    profile: AnalysisProfile;
    semanticCap?: number;
    llmEnabled: boolean;
    preferWorker: boolean;
}
export declare function resolvePresetName(options?: BuildReportOptions): AnalysisPresetName;
/** CLI 인자 없을 때 RAM·메시지 수 기반 자동 preset */
export declare function autoPresetFromMachine(profile: MachineProfile, messageCount?: number): AnalysisPresetName;
export declare function resolvePresetNameWithAuto(options?: BuildReportOptions, messageCount?: number): AnalysisPresetName;
export declare function getPresetEffectiveFlags(options?: BuildReportOptions, messageCount?: number): PresetEffectiveFlags;
/** 명시적 preset·legacy fast만 끔(RAM 자동 speed는 CLI 추천용) */
export declare function presetForcesSemanticOff(options?: BuildReportOptions): boolean;
export declare function presetForcesSentimentOff(options?: BuildReportOptions): boolean;
