import type { LlmCharacterCard, ReportData } from "./types.js";
/** 메시지 상위 10명 — 역할 중복 없이 통계 기반 tagline, LLM은 슬롭·중복 제거 후 보강 */
export declare function resolveCharacterCards(data: ReportData): LlmCharacterCard[];
