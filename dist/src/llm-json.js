function stripThinkingBlocks(text) {
    let out = text;
    out = out.replace(/[\s\S]*?<\/think>/gi, "");
    out = out.replace(/```json\s*/gi, "");
    out = out.replace(/```\s*/g, "");
    return out.trim();
}
function repairJsonSlice(slice) {
    let s = slice;
    s = s.replace(/,\s*([}\]])/g, "$1");
    s = s.replace(/'/g, '"');
    return s;
}
function tryParseObject(slice) {
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
/** LLM 응답에서 JSON 객체 추출 (thinking·fence·서문 허용) */
export function extractLlmJsonObject(text) {
    const cleaned = stripThinkingBlocks(text);
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start)
        return null;
    return tryParseObject(cleaned.slice(start, end + 1));
}
//# sourceMappingURL=llm-json.js.map