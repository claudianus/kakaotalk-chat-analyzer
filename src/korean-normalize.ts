/** KR-WordRank / soynlp 스타일 한국어 전처리 (lovit/krwordrank hangle.normalize 포팅) */
const DOUBLESPACE_RE = /\s+/g;
const REPEAT_CHARS_RE = /(\S)\1{3,}/gu;

export interface NormalizeKoreanTextOptions {
  keepEnglish?: boolean;
  keepNumbers?: boolean;
  keepPunctuation?: boolean;
  repeatCollapseTo?: number;
}

export function normalizeKoreanText(
  doc: string,
  options: NormalizeKoreanTextOptions = {},
): string {
  const { keepEnglish = true, keepNumbers = true, keepPunctuation = false, repeatCollapseTo = 2 } =
    options;

  let allowed = "가-힣";
  if (keepEnglish) allowed += "a-zA-Z";
  if (keepNumbers) allowed += "0-9";
  if (keepPunctuation) allowed += ".,?!";
  const stripRe = new RegExp(`[^${allowed}]`, "gu");

  let out = doc.normalize("NFC");
  if (repeatCollapseTo > 0) {
    out = out.replace(REPEAT_CHARS_RE, (_, ch) => ch.repeat(repeatCollapseTo));
  }
  out = out.replace(stripRe, " ");
  return out.replace(DOUBLESPACE_RE, " ").trim();
}
