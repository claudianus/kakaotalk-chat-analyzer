import { Ajv, type ValidateFunction } from "ajv";
import { buildKcaLlmJsonParseSchema } from "./llm-schema.js";

let validator: ValidateFunction | undefined;

function getValidator(): ValidateFunction {
  if (!validator) {
    const ajv = new Ajv({
      allErrors: true,
      strict: false,
      removeAdditional: false,
    });
    validator = ajv.compile(structuredClone(buildKcaLlmJsonParseSchema()) as object);
  }
  return validator;
}

/** node-llama grammar 스키마와 동일한 Ajv 검증 */
export function validateLlmJsonShape(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  return getValidator()(data) as boolean;
}

/** 테스트·provenance용 — 최대 3건 */
export function llmJsonValidationErrors(data: unknown): string[] {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return ["root must be object"];
  }
  const validate = getValidator();
  validate(data);
  return (validate.errors ?? []).slice(0, 3).map((e) => {
    const path = e.instancePath || "/";
    return `${path}: ${e.message ?? "invalid"}`;
  });
}

/** Ajv 캐시 초기화 (테스트) */
export function resetLlmJsonValidatorForTest(): void {
  validator = undefined;
}
