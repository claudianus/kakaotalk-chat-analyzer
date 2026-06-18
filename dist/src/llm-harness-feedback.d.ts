import type { LlmHarnessQuality, ReportData } from "./types.js";
export type HarnessInferenceCode = "disabled" | "gguf_missing" | "timeout" | "json_parse" | "inference_error";
export type HarnessRepairKind = "parse_fail" | "validation_fail" | "inference";
export declare function buildValidationRepairFeedback(data: ReportData, llmQuality?: LlmHarnessQuality): string;
export declare function buildInferenceRepairFeedback(code: HarnessInferenceCode, skipReason?: string): string;
export declare function buildHarnessRepairFeedback(args: {
    kind: HarnessRepairKind;
    data: ReportData;
    raw?: string;
    llmQuality?: LlmHarnessQuality;
    inferenceCode?: HarnessInferenceCode;
    skipReason?: string;
}): string;
