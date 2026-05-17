import { embeddingThemeMax } from "./report-config.js";
import type { KeywordRankItem } from "./keyword-rank.js";
import type { ReportTopic } from "./types.js";

/** 시맨틱 클러스터 대표어 → semantic 레인 theme */
export function semanticItemsToTopics(
  items: KeywordRankItem[],
  totalMessages: number,
  opts?: { max?: number },
): ReportTopic[] {
  const cap = opts?.max ?? embeddingThemeMax();
  const topics: ReportTopic[] = [];
  for (const item of items.slice(0, cap)) {
    const terms = item.label
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    if (terms.length < 1) continue;
    const pct = Math.round(Math.min(100, (item.messageHits / Math.max(totalMessages, 1)) * 100) * 10) / 10;
    if (pct < 0.5) continue;
    topics.push({
      id: `embed-${topics.length}`,
      kind: "theme",
      title: terms.slice(0, 2).join(" · "),
      terms: terms.slice(0, 8),
      messagePercent: pct,
    });
  }
  return topics;
}

/** @deprecated topic-merge semantic 레인 사용 */
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
    .slice(0, 12);
}
