import type { AnalysisPresetName } from "./analysis-preset.js";
/** preset·RAM 기준 Hub 임베딩 id — IBM Granite R2 우선, 레거시 폰백 */
export declare function resolveDefaultSemanticHubId(preset: AnalysisPresetName, headroomGb: number): string;
/** quality·ultra — 로컬 KURE ONNX (Release zip, ~2.1GB) — 레거시, 점진 폐기 */
export declare function shouldPreferBundledKure(preset: AnalysisPresetName, headroomGb: number): boolean;
/** 번들 시맨틱 id — Granite 우선, 레거시 KURE/embed 폰백 */
export declare function resolveBundledSemanticModelId(preset: AnalysisPresetName, headroomGb: number): string;
/** 번들 ONNX가 있을 때 preset·RAM 기준 시맨틱 번들 사용 여부 (순수 정책) */
export declare function shouldPreferBundledSemanticPolicy(preset: AnalysisPresetName, headroomGb: number): boolean;
/** 오프라인 번들 우선 — `KCA_PREFER_BUNDLED_SEMANTIC=0` 이면 Hub */
export declare function shouldPreferBundledSemantic(preset: AnalysisPresetName, headroomGb: number): boolean;
/** 로드 실패 시 순차 폰백 — Granite → KoELECTRA → 번들 */
export declare function semanticEmbeddingFallbackIds(primary: string): string[];
