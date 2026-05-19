import type { ReportData } from "./types.js";
import type { LlmJsonShape } from "./llm-json.js";
import type { LlmInsights } from "./types.js";
export declare function sanitizeLlmDeck(parsed: LlmJsonShape, data: ReportData): Partial<LlmInsights>;
