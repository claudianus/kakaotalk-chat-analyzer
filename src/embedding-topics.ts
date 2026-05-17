import type { KeywordRankItem } from "./keyword-rank.js";
import type { ReportTopic } from "./types.js";

const MAX_EMBEDDING_THEMES = 3;

/** 시맨틱 클러스터 대표어 → theme 주제 (KCA_EMBEDDING_TOPICS=1) */
export function semanticItemsToTopics(
  items: KeywordRankItem[],
  totalMessages: number,
): ReportTopic[] {
  const topics: ReportTopic[] = [];
  for (const item of items.slice(0, MAX_EMBEDDING_THEMES)) {
    const terms = item.label
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    if (terms.length < 1) continue;
    const pct = Math.round(Math.min(100, (item.messageHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
    if (pct < 1) continue;
    topics.push({
      id: `embed-${topics.length}`,
      kind: "theme",
      title: `${terms.slice(0, 2).join(" · ")} (임베딩)`,
      terms: terms.slice(0, 6),
      messagePercent: pct,
    });
  }
  return topics;
}

export function mergeEmbeddingThemes(
  graphTopics: ReportTopic[],
  semanticItems: KeywordRankItem[],
  totalMessages: number,
): ReportTopic[] {
  const embedding = semanticItemsToTopics(semanticItems, totalMessages);
  if (embedding.length === 0) return graphTopics;
  const merged = [...graphTopics];
  for (const t of embedding) {
    const dup = merged.some(
      (g) => g.kind === "theme" && g.terms[0] && t.terms[0] && g.terms[0] === t.terms[0],
    );
    if (!dup) merged.push(t);
  }
  return merged
    .sort((a, b) => b.messagePercent - a.messagePercent || b.terms.length - a.terms.length)
    .slice(0, 8);
}
