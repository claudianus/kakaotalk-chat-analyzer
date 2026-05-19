import type { AnalysisPresetName } from "./analysis-preset.js";
/** preset·RAM 기준 Hub 임베딩 id (env·번들 제외) — KoELECTRA 계열만 기본 */
export declare function resolveDefaultSemanticHubId(preset: AnalysisPresetName, headroomGb: number): string;
/** quality·ultra — 로컬 KURE ONNX (Release zip, ~2.1GB) */
export declare function shouldPreferBundledKure(preset: AnalysisPresetName, headroomGb: number): boolean;
/** 번들 시맨틱 id — ultra/quality는 KURE 시도(없으면 로드 폴백), 그 외 embed */
export declare function resolveBundledSemanticModelId(preset: AnalysisPresetName, headroomGb: number): string;
/** 오프라인 번들 우선 — `KCA_PREFER_BUNDLED_SEMANTIC=0` 이면 Hub KoELECTRA */
export declare function shouldPreferBundledSemantic(preset: AnalysisPresetName, headroomGb: number): boolean;
/** 로드 실패 시 순차 폴백 — Hub KURE/BGE는 env 지정 시만, 번들 KURE 실패 시 embed */
export declare function semanticEmbeddingFallbackIds(primary: string): string[];
