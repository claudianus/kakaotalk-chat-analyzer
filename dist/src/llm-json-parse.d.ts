import type { LlmJsonShape } from "./llm-json.js";
/** Ajv 통과 전 loose 파싱 — 진단·피드백용 */
export declare function parseJsonSliceLoose(slice: string): unknown | null;
/** heuristic → trailing-comma → jsonrepair 순으로 파싱 후 Ajv 검증 */
export declare function parseAndValidateLlmJsonSlice(slice: string): LlmJsonShape | null;
