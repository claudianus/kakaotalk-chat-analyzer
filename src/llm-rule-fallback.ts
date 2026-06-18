import { fallbackRoomArchetype } from "./llm-deck-validate.js";
import type { LlmRunPlan } from "./llm-policy.js";
import type { LlmEnrichmentResult } from "./llm-summarize.js";
import type { LlmHarnessQuality, LlmInsights, ReportData } from "./types.js";

function deckFieldCount(ins: LlmInsights): number {
  let n = 0;
  if (ins.insightBullets?.length) n += ins.insightBullets.length;
  if (ins.roomArchetype) n += 1;
  if (ins.dyadInsight) n += 1;
  if (ins.moments?.length) n += ins.moments.length;
  if (ins.relationshipBeats?.length) n += ins.relationshipBeats.length;
  if (ins.insideJokes?.length) n += ins.insideJokes.length;
  if (ins.characterCards?.length) n += ins.characterCards.length;
  if (ins.dayMicroStories?.length) n += ins.dayMicroStories.length;
  return n;
}

/** LLM 추론·검증 전부 실패 시 규칙 기반 deck — 리포트에 최소한의 스토리 레이어를 남김 */
export function buildRuleBasedLlmFallback(
  data: ReportData,
  plan: LlmRunPlan,
  args?: { repairAttempts?: number; reason?: string },
): LlmEnrichmentResult {
  const llmInsights: LlmInsights = {};
  const archetype = fallbackRoomArchetype(data);
  if (archetype) llmInsights.roomArchetype = archetype;

  const bullets = data.highlights
    .map((h) => h.trim())
    .filter((h) => h.length > 4)
    .slice(0, 4);
  if (bullets.length) llmInsights.insightBullets = bullets;

  const topDyad = data.interaction?.topPairs?.[0];
  if (topDyad && topDyad.replies >= 3) {
    llmInsights.dyadInsight = `**${topDyad.fromAlias}→${topDyad.toAlias}** 응답이 ${topDyad.replies}회로 가장 잦습니다.`;
  }

  const jokes = data.repeatedPhrases
    .filter((p) => p.count >= 5 && p.label.length >= 2)
    .slice(0, 3)
    .map((p) => ({
      label: p.label.slice(0, 24),
      whyFunny: `반복 ${p.count}회`,
      evidenceKeywords: data.keywords.slice(0, 2).map((k) => k.label),
    }));
  if (jokes.length) llmInsights.insideJokes = jokes;

  if (deckFieldCount(llmInsights) === 0) {
    return {
      used: false,
      plan,
      skipReason: args?.reason ?? "LLM·규칙 fallback 모두 비어 있음",
    };
  }

  const acceptedClaims = deckFieldCount(llmInsights);
  const llmQuality: LlmHarnessQuality = {
    schemaValid: false,
    acceptedClaims,
    droppedClaims: 0,
    repairAttempts: args?.repairAttempts ?? 0,
    fallbackUsed: true,
    validationWarnings: ["rule_based_fallback_after_harness_failure"],
  };

  return {
    used: true,
    plan,
    narrative: data.narrative,
    llmInsights,
    llmQuality,
  };
}
