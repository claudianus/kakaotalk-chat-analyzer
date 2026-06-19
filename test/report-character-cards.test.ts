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

test("resolveCharacterCards keeps taglines diverse and rejects slop", () => {
  const participants = Array.from({ length: 10 }, (_, i) => ({
    alias: `U${i}`,
    messages: 200 - i * 8,
    characters: 1200 + i * 40,
    averageLength: i === 2 ? 48 : 11 + i,
    attachmentMessages: i === 3 ? 20 : 0,
    linkMessages: i === 4 ? 15 : 0,
    sharePercent: 12 - i,
    characterSharePercent: 10,
    nightMessages: i === 5 ? 40 : 2,
    maxConsecutive: i === 6 ? 12 : 3,
  }));
  const data = {
    participants,
    llmInsights: {
      characterCards: [
        { alias: "U0", tagline: "흥미롭게도 핵심 멤버", statHook: "hook0" },
        { alias: "U1", tagline: "꾸준히 대화에 참여하는 멤버", statHook: "hook1" },
      ],
    },
  } as unknown as ReportData;
  const cards = resolveCharacterCards(data);
  const taglines = cards.map((c) => c.tagline);
  const unique = new Set(taglines.map((t) => t.toLowerCase()));
  assert.equal(unique.size, taglines.length, `duplicate taglines: ${taglines.join(" | ")}`);
  assert.ok(!cards[0]?.tagline.includes("흥미롭게도"));
  assert.ok(!cards[1]?.tagline.includes("꾸준히 대화에 참여"));
});
