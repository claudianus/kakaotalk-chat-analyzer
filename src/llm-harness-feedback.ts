import { diagnoseLlmJsonParseFailure } from "./llm-json.js";
import { AI_SLOP_EXAMPLE_PHRASES } from "./llm-slop.js";
import type { LlmHarnessQuality, ReportData } from "./types.js";

export type HarnessInferenceCode =
  | "disabled"
  | "gguf_missing"
  | "timeout"
  | "json_parse"
  | "inference_error";

export type HarnessRepairKind = "parse_fail" | "validation_fail" | "inference";

const INFERENCE_HINTS: Partial<Record<HarnessInferenceCode, string>> = {
  timeout: "출력을 짧게 — paragraphs 2개와 insightBullets 2개 위주로 JSON만 출력하세요.",
  inference_error: "JSON 객체 하나만 출력하세요. 설명·fence 금지.",
  gguf_missing: "모델 로드 실패 — 출력 형식과 무관합니다.",
  json_parse: "유효한 JSON 객체 하나만 출력하세요.",
  disabled: "LLM 비활성",
};

function topEvidenceKeywords(data: ReportData, limit = 4): string[] {
  return data.keywords
    .map((k) => k.label.trim())
    .filter((l) => l.length >= 2)
    .slice(0, limit);
}

export function buildValidationRepairFeedback(
  data: ReportData,
  llmQuality?: LlmHarnessQuality,
): string {
  const evidence = topEvidenceKeywords(data);
  const warnings = llmQuality?.validationWarnings?.slice(0, 4) ?? [];
  const dropped = llmQuality?.droppedClaims ?? 0;
  const parts = [
    `이전 JSON은 파싱됐지만 검증 실패(accepted 0, dropped ${dropped}).`,
    evidence.length ? `문장에 반드시 넣을 키워드: ${evidence.join(", ")}` : "",
    warnings.length ? `탈락 사유: ${warnings.join(", ")}` : "",
    "paragraphs 2~3개, insightBullets 2~4개, roomArchetype.name/description에 위 키워드·입력 통계 숫자를 포함하세요.",
    `AI 슬롭·일반론 금지(예: ${AI_SLOP_EXAMPLE_PHRASES.slice(0, 5).join(", ")}). 구체 키워드·입력 통계만.`,
  ];
  return parts.filter(Boolean).join(" ");
}

export function buildInferenceRepairFeedback(
  code: HarnessInferenceCode,
  skipReason?: string,
): string {
  const hint = INFERENCE_HINTS[code] ?? "JSON 객체 하나만 다시 출력하세요.";
  const tail = skipReason ? ` (${skipReason.slice(0, 120)})` : "";
  return `이전 추론 실패 [${code}]. ${hint}${tail}`;
}

export function buildHarnessRepairFeedback(args: {
  kind: HarnessRepairKind;
  data: ReportData;
  raw?: string;
  llmQuality?: LlmHarnessQuality;
  inferenceCode?: HarnessInferenceCode;
  skipReason?: string;
}): string {
  if (args.kind === "parse_fail") {
    const detail = args.raw ? diagnoseLlmJsonParseFailure(args.raw) : "JSON 파싱 실패";
    const evidence = topEvidenceKeywords(args.data);
    const evidenceHint = evidence.length ? ` 키워드 포함: ${evidence.join(", ")}.` : "";
    return `${detail}.${evidenceHint} 마크다운 fence·설명 없이 JSON만 출력하세요.`;
  }
  if (args.kind === "validation_fail") {
    return buildValidationRepairFeedback(args.data, args.llmQuality);
  }
  return buildInferenceRepairFeedback(args.inferenceCode ?? "inference_error", args.skipReason);
}
