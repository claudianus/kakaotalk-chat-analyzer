import assert from "node:assert/strict";
import test from "node:test";
import { emptyReportData } from "../src/report-empty.js";
import { runLlmHarness, buildHarnessAttemptLadder } from "../src/llm-harness.js";
import {
  LLM_HARNESS_CASES,
  type LlmHarnessAttemptExpect,
} from "./fixtures/llm-harness-cases.js";
import { withEnv } from "./helpers/with-env.js";
import type { LlmHarnessAttemptRecord } from "../src/types.js";

function assertAttemptShape(
  actual: LlmHarnessAttemptRecord[],
  expected: LlmHarnessAttemptExpect[],
  caseName: string,
): void {
  assert.ok(
    actual.length >= expected.length,
    `${caseName}: attempts ${actual.length} < expected ${expected.length}`,
  );
  for (let i = 0; i < expected.length; i += 1) {
    const exp = expected[i]!;
    const act = actual[i]!;
    if (exp.label !== undefined) {
      assert.equal(act.label, exp.label, `${caseName}[${i}].label`);
    }
    assert.equal(act.ok, exp.ok, `${caseName}[${i}].ok`);
    if (exp.code !== undefined) {
      assert.equal(act.code, exp.code, `${caseName}[${i}].code`);
    }
  }
}

const harnessPlan = (size: "0.8B" | "4B") => ({
  enabled: true,
  size,
  reason: "harness matrix test",
  timeoutMs: 45_000,
});

for (const row of LLM_HARNESS_CASES) {
  test(`llm-harness matrix: ${row.name}`, async () => {
    await withEnv(
      {
        KCA_LLM: "1",
        KCA_LLM_MOCK: row.mock,
        KCA_LLM_MIN_FREE_GB: row.minFreeGb ?? "0",
      },
      async () => {
        const result = await runLlmHarness(emptyReportData(), harnessPlan(row.planSize));
        assert.equal(result.used, row.expectUsed, `${row.name}: used`);
        if (row.expectRepairAttempts !== undefined) {
          assert.equal(
            result.llmQuality?.repairAttempts,
            row.expectRepairAttempts,
            `${row.name}: repairAttempts`,
          );
        }
        if (row.expectAttempts?.length) {
          assert.ok(result.llmQuality?.attempts, `${row.name}: attempts missing`);
          assertAttemptShape(result.llmQuality!.attempts!, row.expectAttempts, row.name);
        }
        if (!row.expectUsed) {
          assert.ok(result.skipReason, `${row.name}: skipReason`);
        }
      },
    );
  });
}

test("buildHarnessAttemptLadder 0.8B has no downgrade step", () => {
  const ladder = buildHarnessAttemptLadder(harnessPlan("0.8B"));
  assert.equal(ladder.length, 3);
  assert.ok(!ladder.some((a) => a.label === "downgrade-0.8B"));
});

test("buildHarnessAttemptLadder 4B ends with downgrade", () => {
  const ladder = buildHarnessAttemptLadder(harnessPlan("4B"));
  assert.equal(ladder.at(-1)?.label, "downgrade-0.8B");
});

test("harness records freeRamGb on each attempt", async () => {
  await withEnv(
    { KCA_LLM: "1", KCA_LLM_MOCK: "valid", KCA_LLM_MIN_FREE_GB: "0" },
    async () => {
    const result = await runLlmHarness(emptyReportData(), harnessPlan("0.8B"));
    const attempt = result.llmQuality?.attempts?.[0];
    assert.ok(attempt);
    assert.equal(typeof attempt?.freeRamGb, "number");
    assert.ok((attempt?.freeRamGb ?? 0) > 0);
  });
});
