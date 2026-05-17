import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { isNoiseKeyword } from "./keyword-quality.js";

/** 주제맵·c-TF-IDF 전용 담화어 (키워드 stopword에 추가) */
const TOPIC_DISCOURSE = new Set([
  "있어요",
  "있음",
  "없어요",
  "그런거",
  "이런거",
  "저런거",
  "그런",
  "이런",
  "이건",
  "그건",
  "하네요",
  "되면",
  "하면",
  "해서",
  "계속",
  "갑자기",
  "일단",
  "근데",
  "그냥",
  "뭔가",
  "약간",
  "완전",
  "진짜",
  "아니",
  "맞아",
  "오케이",
  "이야기",
  "이해",
  "이유",
  "시간",
  "오늘",
  "내일",
  "어제",
  "지금",
  "다시",
  "정도",
  "생각",
  "사람",
  "우리",
  "거기",
  "여기",
]);

export function buildTopicStopwords(): Set<string> {
  const s = buildKeywordStopwords();
  for (const w of TOPIC_DISCOURSE) s.add(w);
  return s;
}

export function isTopicDiscourse(term: string): boolean {
  return TOPIC_DISCOURSE.has(term.trim());
}

export function filterMeaningfulTopicTerms(
  terms: string[],
  stopwords: ReadonlySet<string>,
): string[] {
  return terms.filter((t) => !stopwords.has(t) && !isNoiseKeyword(t) && !isTopicDiscourse(t));
}
