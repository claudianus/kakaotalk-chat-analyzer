export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

/** 카드·헤드라인용 축약 (만·억, k/M 미사용) */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const n = Math.round(value);
  if (n >= 100_000_000) {
    const v = n / 100_000_000;
    return v >= 10 ? `${Math.round(v)}억` : `${trimCompactDecimal(v)}억`;
  }
  if (n >= 10_000) {
    const v = n / 10_000;
    return v >= 100 ? `${Math.round(v)}만` : `${trimCompactDecimal(v)}만`;
  }
  return formatNumber(n);
}

function trimCompactDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** 응답 간격(분)을 읽기 쉬운 한국어로 */
export function formatReplyGapMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  if (minutes < 1 / 60) return "1초 미만";
  if (minutes < 1) {
    const sec = Math.max(1, Math.round(minutes * 60));
    return `${sec}초`;
  }
  if (minutes < 10) {
    const rounded = Math.round(minutes * 10) / 10;
    return rounded < 1 ? `${Math.round(minutes * 60)}초` : `${rounded}분`;
  }
  return `${Math.round(minutes)}분`;
}

const MASK_PLACEHOLDER_PREFIX = "\uE000kca";
const MASK_PLACEHOLDER_SUFFIX = "\uE001";

/** 프라이버시 마스킹 닉네임(김*철, 김***영, 김* 등) — 마크다운 ** 파싱 전 보호 */
const MASKED_DISPLAY_NAME_RE =
  /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}]\*{1,6}[\p{L}\p{N}](?![\p{L}\p{N}])|[\p{L}\p{N}]\*(?![\p{L}\p{N}*]))/gu;

function normalizeMarkdownAsterisks(text: string): string {
  return text.replace(/[\uFF0A\u2217\u2731]/g, "*");
}

function protectMaskedDisplayNames(text: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const protectedText = text.replace(MASKED_DISPLAY_NAME_RE, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `${MASK_PLACEHOLDER_PREFIX}${idx}${MASK_PLACEHOLDER_SUFFIX}`;
  });
  return { text: protectedText, tokens };
}

function restoreMaskedDisplayNames(html: string, tokens: string[]): string {
  let out = html;
  for (let i = 0; i < tokens.length; i++) {
    const placeholder = `${MASK_PLACEHOLDER_PREFIX}${i}${MASK_PLACEHOLDER_SUFFIX}`;
    out = out.split(placeholder).join(escapeHtml(tokens[i]!));
  }
  return out;
}

/** LLM·서사 텍스트: **강조** 마크다운 + 마스킹 닉네임 안전 렌더 */
export function renderHighlightLine(line: string): string {
  const normalized = normalizeMarkdownAsterisks(line);
  const { text: protectedText, tokens } = protectMaskedDisplayNames(normalized);
  const parts = protectedText.split("**");
  const html = parts
    .map((part, i) => (i % 2 === 1 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part)))
    .join("");
  return restoreMaskedDisplayNames(html, tokens);
}
