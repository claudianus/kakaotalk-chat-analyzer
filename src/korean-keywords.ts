import {
  FRAGMENT_TAIL_RE,
  KOREAN_CHAT_STOPWORDS,
  MORPHOLOGICAL_FRAGMENTS,
  REACTION_ONLY_RE,
  VERB_FRAGMENT_RE,
} from "./korean-stopwords.js";

const URL_RE = /\bhttps?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HASHTAG_RE = /#([가-힣A-Za-z][가-힣A-Za-z0-9_]{1,22})/g;
/** 자모 축약어 (SLANG_CANON 키와 동기화) */
const JAMO_SLANG_RE =
  /(?:ㄹㅇ|ㅇㅈ|ㅇㅋ|ㄱㅅ|ㄳ|ㅈㅅ|ㅊㅋ|ㅊㅊ|ㄴㄴ|ㅁㅊ|ㅂㅃ|ㅃㅃ)/g;

/** 구두점·공백·괄호 등으로 1차 분할 */
const SEGMENT_SPLIT_RE = /[\s,.!?…~·|/\\;:()[\]{}<>"'`「」『』【】\u2014\u2013]+/u;
const HANGUL_RUN_RE = /[\uAC00-\uD7A3]+/g;
const HANGUL_CHAR_RE = /[\uAC00-\uD7A3]/;
const LATIN_TOKEN_RE = /[A-Za-z][A-Za-z0-9_+-]{1,}/g;

/** 긴 붙여쓰기에서 조사 경계로 추가 분할 (보수적) */
const PARTICLE_BOUNDARY_RE =
  /(?<=[\uAC00-\uD7A3]{2,})(?:에서|으로|부터|까지|에게|한테|께서|라며|잖아|거든|습니다|했어요|해요|어요|네요|습니다|이에요|예요)(?=[\uAC00-\uD7A3])|(?<=[\uAC00-\uD7A3]{2,})(?:은|는|이|가|을|를|의|에|와|과|도|만|며|고|서|면|니|다|게|지|네|요|죠|함|라)(?=[\uAC00-\uD7A3]|$)/gu;

const TRAILING_PARTICLE_RE =
  /(?:에서|으로|부터|까지|에게|한테|께서|습니다|했어요|해요|어요|네요|이에요|예요|거든요|잖아요|은|는|이|가|을|를|의|에|와|과|도|만|며|고|서|면|니|다|게|지|네|요|죠|함|라)$/u;

/** 채팅 축약 → 표기 통일 (키워드 라벨) */
const SLANG_CANON = new Map<string, string>([
  ["ㄹㅇ", "리얼"],
  ["레알", "리얼"],
  ["리얼", "리얼"],
  ["ㅇㅈ", "인정"],
  ["ㅇㅋ", "오케이"],
  ["오키", "오케이"],
  ["ㅇㅋㅇㅋ", "오케이"],
  ["ㄱㅅ", "감사"],
  ["ㄳ", "감사"],
  ["ㅈㅅ", "죄송"],
  ["ㅊㅋ", "축하"],
  ["ㅊㅊ", "축하"],
  ["ㄴㄴ", "노노"],
  ["노노", "노노"],
  ["ㅂㅂ", "바이"],
  ["ㅃㅃ", "바이"],
  ["ㅁㅊ", "미친"],
  ["미쳤", "미친"],
  ["개웃", "개웃김"],
  ["레전드", "레전드"],
  ["레게", "레전드"],
  ["킹받", "킹받음"],
  ["킹받음", "킹받음"],
  ["노답", "노답"],
  ["현타", "현타"],
  ["인싸", "인싸"],
  ["아싸", "아싸"],
  ["갓", "갓"],
  ["존맛", "존맛"],
  ["존잼", "존잼"],
  ["노잼", "노잼"],
  ["핵노잼", "노잼"],
  ["TMI", "tmi"],
  ["tmi", "tmi"],
  ["JMT", "jmt"],
  ["jmt", "jmt"],
]);

export interface KoreanKeywordOptions {
  senderNames: ReadonlySet<string>;
  exclude?: ReadonlySet<string>;
  /** 메시지당 동일 키워드 1회만 (채팅 스팸 완화) */
}

/**
 * 한국어 오픈채팅·구어 특화 키워드 추출
 * - 띄어쓰기·붙여쓰기 혼용, 조사 경계, 2~3어절 구, 해시태그
 * - 붙여쓴 한글 덩어리에서 길이 제한 n-gram 보조
 * - 메시지당 동일 토큰 1회만 (Set)
 */
export function extractKoreanKeywords(
  message: string,
  options: KoreanKeywordOptions,
): string[] {
  const prepared = prepareMessage(message);
  if (!prepared) return [];

  const bag = new Set<string>();
  const segments = prepared.split(SEGMENT_SPLIT_RE).filter((s) => s.length > 0);

  for (const segment of segments) {
    collectFromSegment(segment, bag, options);
  }

  return [...bag];
}

/** KR-WordRank 보조: 해시태그만 (슬랭·자모는 WordRank·불용어 층에서 처리) */
export function extractSupplementalKeywords(
  message: string,
  options: KoreanKeywordOptions,
): string[] {
  const prepared = prepareMessage(message);
  if (!prepared) return [];
  const bag = new Set<string>();
  for (const segment of prepared.split(SEGMENT_SPLIT_RE).filter((s) => s.length > 0)) {
    for (const m of segment.matchAll(HASHTAG_RE)) {
      tryAdd(bag, m[1]!, options);
    }
  }
  return [...bag];
}

function prepareMessage(message: string): string {
  let t = message.normalize("NFC");
  t = t.replace(URL_RE, " ").replace(EMAIL_RE, " ").replace(PHONE_RE, " ");
  t = t.replace(EMOJI_RE, " ");
  t = t.replace(/[^\S\n]+/g, " ");
  t = collapseStretch(t);
  return t.trim();
}

/** ㅋㅋㅋ, ㅎㅎㅎ, 같은 글자 4연속+ 완화 */
function collapseStretch(text: string): string {
  return text
    .replace(/([ㅋㅎㅠㅜ]){4,}/gu, "$1$1$1")
    .replace(/([\uAC00-\uD7A3])\1{3,}/gu, "$1$1");
}

function collectFromSegment(
  segment: string,
  bag: Set<string>,
  options: KoreanKeywordOptions,
): void {
  for (const m of segment.matchAll(HASHTAG_RE)) {
    tryAdd(bag, m[1]!, options);
  }
  for (const m of segment.matchAll(JAMO_SLANG_RE)) {
    tryAdd(bag, m[0]!, options);
  }

  const tokens: string[] = [];

  for (const m of segment.matchAll(LATIN_TOKEN_RE)) {
    const canon = canonToken(m[0]!);
    if (canon && acceptToken(canon, options)) tokens.push(canon);
  }

  const hangulPieces = splitHangulChunk(segment);
  for (const piece of hangulPieces) {
    for (const expanded of expandHangulPiece(piece)) {
      if (acceptToken(expanded, options)) tokens.push(expanded);
    }
  }

  for (const t of tokens) tryAdd(bag, t, options);

  for (let i = 0; i < tokens.length; i += 1) {
    if (i + 1 < tokens.length) {
      const phrase = joinPhrase(tokens[i]!, tokens[i + 1]!);
      if (phrase) tryAdd(bag, phrase, options);
    }
    if (i + 2 < tokens.length) {
      const phrase = joinPhrase(tokens[i]!, tokens[i + 1]!, tokens[i + 2]!);
      if (phrase && phrase.length <= 24) tryAdd(bag, phrase, options);
    }
  }

  const hangulOnly = segment.replace(/[^\uAC00-\uD7A3]/g, "");
  const hadSpace = /\s/.test(segment);
  if (!hadSpace && hangulOnly.length >= 5 && hangulOnly.length <= 28) {
    for (const gram of mineHangulNgrams(hangulOnly)) {
      if (acceptToken(gram, options)) tryAdd(bag, gram, options);
    }
  }
}

function splitHangulChunk(segment: string): string[] {
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(HANGUL_RUN_RE.source, "gu");
  while ((m = re.exec(segment)) !== null) {
    const run = m[0]!;
    if (run.length <= 18) {
      parts.push(run);
      continue;
    }
    const split = run.split(PARTICLE_BOUNDARY_RE).filter((p) => p.length >= 3);
    if (split.length > 1) parts.push(...split);
    else parts.push(run);
  }
  return parts;
}

function expandHangulPiece(piece: string): string[] {
  const base = piece.trim();
  if (!base) return [];
  const canon = canonToken(base);
  if (!canon) return [];
  if (canon.length >= 4 && HANGUL_CHAR_RE.test(canon)) {
    const stem = stripTrailingParticle(canon);
    if (stem && stem.length >= 2 && stem !== canon && !MORPHOLOGICAL_FRAGMENTS.has(stem)) {
      return [stem];
    }
  }
  return [canon];
}

function stripTrailingParticle(word: string): string {
  let w = word;
  for (let i = 0; i < 2; i += 1) {
    const next = w.replace(TRAILING_PARTICLE_RE, "");
    if (next === w || next.length < 2) break;
    w = next;
  }
  return w;
}

function mineHangulNgrams(compact: string): string[] {
  const out = new Set<string>();
  const maxSize = Math.min(6, compact.length);
  for (let size = 3; size <= maxSize; size += 1) {
    for (let i = 0; i <= compact.length - size; i += 1) {
      const gram = compact.slice(i, i + size);
      if (!MORPHOLOGICAL_FRAGMENTS.has(gram)) out.add(gram);
      if (out.size >= 8) return [...out];
    }
  }
  return [...out];
}

function joinPhrase(...parts: string[]): string | null {
  const filtered = parts.filter((p) => p.length >= 2);
  if (filtered.length !== parts.length) return null;
  const allHangul = filtered.every((p) => /^[\uAC00-\uD7A3]+$/.test(p));
  if (allHangul) {
    if (filtered.length === 2) return `${filtered[0]} ${filtered[1]}`;
    return `${filtered[0]} ${filtered[1]} ${filtered[2]}`;
  }
  return filtered.join(" ");
}

function canonToken(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = /^[A-Za-z0-9_+-]+$/.test(t) ? t.toLowerCase() : t;
  return SLANG_CANON.get(lower) ?? SLANG_CANON.get(t) ?? lower;
}

function acceptToken(token: string, options: KoreanKeywordOptions): boolean {
  if (token.length < 2 || token.length > 28) return false;
  if (/^\d+$/.test(token)) return false;
  if (MORPHOLOGICAL_FRAGMENTS.has(token)) return false;
  if (VERB_FRAGMENT_RE.test(token)) return false;
  if (REACTION_ONLY_RE.test(token) && !SLANG_CANON.has(token)) return false;
  if (KOREAN_CHAT_STOPWORDS.has(token)) return false;
  if (options.exclude?.has(token)) return false;
  if (options.senderNames.has(token)) return false;
  const hangulCount = [...token].filter((c) => HANGUL_CHAR_RE.test(c)).length;
  const hangulOnly = hangulCount === token.length;
  if (hangulOnly && token.length === 2) {
    if (MORPHOLOGICAL_FRAGMENTS.has(token)) return false;
    if (FRAGMENT_TAIL_RE.test(token) && !SLANG_CANON.has(token)) return false;
  }
  if (hangulCount === 1 && token.length <= 2) return false;
  if (/^[A-Za-z]{1,2}$/.test(token)) return false;
  return true;
}

function tryAdd(bag: Set<string>, token: string, options: KoreanKeywordOptions): void {
  const canon = canonToken(token);
  if (!canon || !acceptToken(canon, options)) return;
  bag.add(canon);
}
