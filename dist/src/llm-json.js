import { parseAndValidateLlmJsonSlice, parseJsonSliceLoose } from "./llm-json-parse.js";
import { llmJsonValidationErrors, validateLlmJsonShape } from "./llm-json-validate.js";
export { validateLlmJsonShape, llmJsonValidationErrors } from "./llm-json-validate.js";
function stripThinkingBlocks(text) {
    let out = text;
    out = out.replace(/[\s\S]*?<\/think>/gi, "");
    out = out.replace(/```json\s*/gi, "");
    out = out.replace(/```\s*/g, "");
    return out.trim();
}
/** 첫 `{`부터 중괄호 깊이로 닫는 `}` 위치 (문자열 내부 무시) */
export function findBalancedJsonEnd(text, start) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === '"')
                inString = false;
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === "{")
            depth += 1;
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
/** LLM 응답에서 JSON 객체 추출 (thinking·fence·서문·truncation repair) */
export function extractLlmJsonObject(text) {
    const cleaned = stripThinkingBlocks(text);
    const start = cleaned.indexOf("{");
    if (start < 0)
        return null;
    const end = findBalancedJsonEnd(cleaned, start);
    if (end > start) {
        const balanced = parseAndValidateLlmJsonSlice(cleaned.slice(start, end + 1));
        if (balanced)
            return balanced;
    }
    return parseAndValidateLlmJsonSlice(cleaned.slice(start));
}
/** parse 실패 원인 — harness repair 프롬프트용 */
export function diagnoseLlmJsonParseFailure(raw) {
    const cleaned = stripThinkingBlocks(raw);
    const start = cleaned.indexOf("{");
    if (start < 0) {
        return "JSON 객체({...})가 없습니다";
    }
    const end = findBalancedJsonEnd(cleaned, start);
    const slice = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
    const value = parseJsonSliceLoose(slice);
    if (value === null) {
        return "JSON 문법 오류 — 닫는 따옴표·괄호를 확인하세요";
    }
    if (!validateLlmJsonShape(value)) {
        const errs = llmJsonValidationErrors(value);
        return errs.length ? `스키마 오류: ${errs.join("; ")}` : "스키마 검증 실패";
    }
    return "파싱 불가(형식 확인 필요)";
}
/** grammar.parse 1차, extract+repair+Ajv 2차 */
export function parseLlmJsonResponse(raw, grammar) {
    if (grammar) {
        try {
            const parsed = grammar.parse(raw);
            if (validateLlmJsonShape(parsed))
                return parsed;
        }
        catch {
            /* fallback */
        }
    }
    return extractLlmJsonObject(raw);
}
//# sourceMappingURL=llm-json.js.map