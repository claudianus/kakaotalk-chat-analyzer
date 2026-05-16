/** 라틴 표기 → 채팅에서 흔한 한글 표기로 합침(분산 방지) */
const LATIN_TO_CANONICAL: Record<string, string> = {
  claude: "클로드",
  codex: "코덱스",
  cursor: "커서",
  chatgpt: "챗gpt",
  gemini: "제미니",
  openai: "오픈ai",
  github: "깃허브",
  npm: "npm",
};

export function canonicalKeywordToken(token: string): string {
  if (/^[A-Za-z][A-Za-z0-9+.-]*$/.test(token)) {
    const key = token.toLowerCase();
    return LATIN_TO_CANONICAL[key] ?? key;
  }
  return token;
}
