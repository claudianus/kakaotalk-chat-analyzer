import { jsonrepair } from "jsonrepair";
import { validateLlmJsonShape } from "./llm-json-validate.js";
function repairJsonSlice(slice) {
    let s = slice;
    s = s.replace(/,\s*([}\]])/g, "$1");
    s = s.replace(/'/g, '"');
    return s;
}
function tryParseValue(slice) {
    try {
        return JSON.parse(slice);
    }
    catch {
        try {
            return JSON.parse(repairJsonSlice(slice));
        }
        catch {
            return null;
        }
    }
}
function tryJsonRepairParse(slice) {
    try {
        const repaired = jsonrepair(slice);
        return tryParseValue(repaired) ?? JSON.parse(repaired);
    }
    catch {
        return null;
    }
}
/** Ajv 통과 전 loose 파싱 — 진단·피드백용 */
export function parseJsonSliceLoose(slice) {
    const trimmed = slice.trim();
    if (!trimmed.startsWith("{"))
        return null;
    for (const candidate of [trimmed, repairJsonSlice(trimmed)]) {
        const value = tryParseValue(candidate);
        if (value !== null)
            return value;
    }
    return tryJsonRepairParse(trimmed);
}
/** heuristic → trailing-comma → jsonrepair 순으로 파싱 후 Ajv 검증 */
export function parseAndValidateLlmJsonSlice(slice) {
    const trimmed = slice.trim();
    if (!trimmed.startsWith("{"))
        return null;
    const candidates = [trimmed, repairJsonSlice(trimmed)];
    for (const candidate of candidates) {
        const value = tryParseValue(candidate);
        if (value && validateLlmJsonShape(value))
            return value;
    }
    const repaired = tryJsonRepairParse(trimmed);
    if (repaired && validateLlmJsonShape(repaired))
        return repaired;
    return null;
}
//# sourceMappingURL=llm-json-parse.js.map