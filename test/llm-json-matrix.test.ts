import assert from "node:assert/strict";
import test from "node:test";
import { parseLlmJsonResponse, extractLlmJsonObject } from "../src/llm-json.js";
import { LLM_JSON_CASES } from "./fixtures/llm-json-cases.js";

for (const row of LLM_JSON_CASES) {
  test(`llm-json matrix: ${row.name}`, () => {
    const parsed = parseLlmJsonResponse(row.raw, null);
    const got = parsed != null;
    assert.equal(
      got,
      row.expectParse,
      `${row.name}: expected parse=${row.expectParse} got=${got} note=${row.note ?? ""}`,
    );
    if (row.expectParse && row.name === "bare-minimal") {
      assert.equal(parsed?.insightBullets?.[0], "참여 40명");
    }
    if (row.expectParse && row.name === "full-deck-shape") {
      assert.equal(parsed?.roomArchetype?.name, "AI 크루");
    }
  });
}

test("extractLlmJsonObject agrees with matrix on fence case", () => {
  const row = LLM_JSON_CASES.find((c) => c.name === "fence-with-prefix");
  assert.ok(row);
  const parsed = extractLlmJsonObject(row!.raw);
  assert.ok(parsed?.paragraphs?.length);
});
