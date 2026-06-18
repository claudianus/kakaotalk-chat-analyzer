import type { LlmCharacterCard, ReportData } from "./types.js";
/** 메시지 상위 10명은 항상 포함 — LLM 카드가 있으면 tagline/statHook 보강 */
export declare function resolveCharacterCards(data: ReportData): LlmCharacterCard[];
