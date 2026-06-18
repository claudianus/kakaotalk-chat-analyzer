import assert from "node:assert/strict";
import test from "node:test";
import { resetLlmMockCallIndex, runLlmMockCompletion } from "../src/llm-mock.js";
import { withEnv } from "./helpers/with-env.js";

test("runLlmMockCompletion sequence advances steps", async () => {
  await withEnv({ KCA_LLM_MOCK: "sequence:invalid,valid" }, async () => {
    resetLlmMockCallIndex();
    const first = await runLlmMockCompletion();
    assert.match(first, /JSON 아님|서사만/);
    const second = await runLlmMockCompletion();
    const parsed = JSON.parse(second);
    assert.ok(parsed.paragraphs?.length);
  });
});

test("runLlmMockCompletion validation_fail returns generic slop JSON", async () => {
  await withEnv({ KCA_LLM_MOCK: "validation_fail" }, async () => {
    const raw = await runLlmMockCompletion();
    assert.match(raw, /흥미로운|압도적/);
  });
});

test("runLlmMockCompletion timeout throws", async () => {
  await withEnv({ KCA_LLM_MOCK: "timeout" }, async () => {
    await assert.rejects(() => runLlmMockCompletion(), /timeout/i);
  });
});
