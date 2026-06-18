import assert from "node:assert/strict";
import test from "node:test";
import { resolveCharacterCards } from "../src/report-character-cards.js";
import type { ReportData } from "../src/types.js";

function miniData(participantCount: number): ReportData {
  const participants = Array.from({ length: participantCount }, (_, i) => ({
    alias: `U${i}`,
    messages: 200 - i * 10,
    characters: 1000,
    averageLength: 12,
    attachmentMessages: 0,
    linkMessages: 0,
    sharePercent: 10,
    characterSharePercent: 10,
    nightMessages: 0,
    maxConsecutive: 2,
  }));
  return {
    participants,
    llmInsights: {
      characterCards: [{ alias: "U0", tagline: "LLM 한줄", statHook: "hook" }],
    },
  } as unknown as ReportData;
}

test("resolveCharacterCards always includes top 10 by messages", () => {
  const cards = resolveCharacterCards(miniData(18));
  assert.equal(cards.length, 10);
  assert.equal(cards[0]?.alias, "U0");
  assert.equal(cards[0]?.tagline, "LLM 한줄");
  assert.equal(cards[9]?.alias, "U9");
});

test("resolveCharacterCards fills stat hooks for non-llm members", () => {
  const cards = resolveCharacterCards(miniData(12));
  assert.ok(cards[5]?.statHook.includes("건"));
});
