import assert from "node:assert/strict";
import test from "node:test";
import { downgradeQwen35Size } from "../src/llm-qwen35.js";

test("downgradeQwen35Size ladder", () => {
  assert.equal(downgradeQwen35Size("9B"), "4B");
  assert.equal(downgradeQwen35Size("4B"), "2B");
  assert.equal(downgradeQwen35Size("2B"), "0.8B");
  assert.equal(downgradeQwen35Size("0.8B"), undefined);
});
