import type { ReportData } from "./types.js";
import type { LlmJsonShape } from "./llm-json.js";
import type { LlmInsights } from "./types.js";
/** LLM 출력의 템플릿 잔여물·오류 메시지·JSON 키 필터링 */
export declare function isLlmGarbageText(value: string): boolean;
export declare function sanitizeLlmDeck(parsed: LlmJsonShape, data: ReportData): Partial<LlmInsights>;
