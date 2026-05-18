export interface LlmJsonShape {
  topicTitles?: { i: number; title: string }[];
  topicProposals?: {
    title: string;
    terms?: string[];
    keywordEvidence?: string[];
  }[];
  paragraphs?: string[];
  insightBullets?: string[];
  shopSearchSummary?: string;
  dyadInsight?: string;
}

function stripThinkingBlocks(text: string): string {
  let out = text;
  out = out.replace(/[\s\S]*?<\/think>/gi, "");
  out = out.replace(/```json\s*/gi, "");
  out = out.replace(/```\s*/g, "");
  return out.trim();
}

function repairJsonSlice(slice: string): string {
  let s = slice;
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/'/g, '"');
  return s;
}

function tryParseObject(slice: string): LlmJsonShape | null {
  try {
    return JSON.parse(slice) as LlmJsonShape;
  } catch {
    try {
      return JSON.parse(repairJsonSlice(slice)) as LlmJsonShape;
    } catch {
      return null;
    }
  }
}

/** 첫 `{`부터 중괄호 깊이로 닫는 `}` 위치 (문자열 내부 무시) */
export function findBalancedJsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** LLM 응답에서 JSON 객체 추출 (thinking·fence·서문 허용) */
export function extractLlmJsonObject(text: string): LlmJsonShape | null {
  const cleaned = stripThinkingBlocks(text);
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  const end = findBalancedJsonEnd(cleaned, start);
  if (end <= start) return null;
  return tryParseObject(cleaned.slice(start, end + 1));
}
