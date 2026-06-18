import assert from "node:assert/strict";
import test from "node:test";
import { parseAndValidateLlmJsonSlice } from "../src/llm-json-parse.js";
import { extractLlmJsonObject, validateLlmJsonShape, llmJsonValidationErrors } from "../src/llm-json.js";

test("parseAndValidateLlmJsonSlice repairs truncated deck JSON", () => {
  const parsed = parseAndValidateLlmJsonSlice('{"paragraphs":["첫","둘째');
  assert.ok(parsed);
  assert.deepEqual(parsed?.paragraphs, ["첫", "둘째"]);
});

test("parseAndValidateLlmJsonSlice rejects wrong types", () => {
  const parsed = parseAndValidateLlmJsonSlice('{"paragraphs":"not-array"}');
  assert.equal(parsed, null);
  const errors = llmJsonValidationErrors({ paragraphs: "not-array" });
  assert.ok(errors.length > 0);
});

test("extractLlmJsonObject uses jsonrepair for unbalanced tail", () => {
  const raw = '설명\n{"insightBullets":["참여 40명"],"paragraphs":["a","b"]';
  const parsed = extractLlmJsonObject(raw);
  assert.ok(parsed?.insightBullets?.[0]?.includes("40"));
});

test("validateLlmJsonShape accepts empty object", () => {
  assert.equal(validateLlmJsonShape({}), true);
});

test("validateLlmJsonShape rejects non-object root", () => {
  assert.equal(validateLlmJsonShape([]), false);
  assert.equal(validateLlmJsonShape(null), false);
});
