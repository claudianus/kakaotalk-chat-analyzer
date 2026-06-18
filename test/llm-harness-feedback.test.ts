import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHarnessRepairFeedback,
  buildInferenceRepairFeedback,
  buildValidationRepairFeedback,
} from "../src/llm-harness-feedback.js";
import { buildLlmPromptPayload } from "../src/llm-input.js";
import { diagnoseLlmJsonParseFailure } from "../src/llm-json.js";
import { emptyReportData } from "../src/report-empty.js";
import { runLlmHarness } from "../src/llm-harness.js";
import { withEnv } from "./helpers/with-env.js";

test("buildLlmPromptPayload appends repair feedback block", () => {
  const data = emptyReportData();
  const prompt = buildLlmPromptPayload(data, {
    repairFeedback: "JSON만 출력하세요",
  });
  assert.match(prompt, /\[수정 지시\] JSON만 출력하세요/);
});

test("buildValidationRepairFeedback mentions warnings and keywords", () => {
  const data = emptyReportData();
  data.keywords = [
    { label: "클로드", count: 10 },
    { label: "코덱스", count: 8 },
  ];
  const feedback = buildValidationRepairFeedback(data, {
    schemaValid: false,
    acceptedClaims: 0,
    droppedClaims: 2,
    validationWarnings: ["키워드 증거 부족"],
    repairAttempts: 0,
    fallbackUsed: false,
  });
  assert.match(feedback, /검증 실패/);
  assert.match(feedback, /클로드/);
  assert.match(feedback, /키워드 증거 부족/);
  assert.match(feedback, /AI 슬롭/);
  assert.match(feedback, /흥미롭게도/);
});

test("buildInferenceRepairFeedback for timeout", () => {
  const feedback = buildInferenceRepairFeedback("timeout", "45s 초과");
  assert.match(feedback, /timeout/);
  assert.match(feedback, /짧게/);
});

test("buildHarnessRepairFeedback parse_fail uses diagnose", () => {
  const raw = "설명만 있고 JSON 없음";
  const feedback = buildHarnessRepairFeedback({
    kind: "parse_fail",
    data: emptyReportData(),
    raw,
  });
  assert.match(feedback, /JSON 객체/);
  assert.equal(diagnoseLlmJsonParseFailure(raw), "JSON 객체({...})가 없습니다");
});

test("harness records repairFeedback on retry attempts", async () => {
  await withEnv(
    { KCA_LLM: "1", KCA_LLM_MOCK: "sequence:invalid,valid", KCA_LLM_MIN_FREE_GB: "0" },
    async () => {
    const result = await runLlmHarness(emptyReportData(), {
      enabled: true,
      size: "0.8B",
      reason: "feedback test",
      timeoutMs: 45_000,
    });
    const retry = result.llmQuality?.attempts?.[1];
    assert.ok(retry?.repairFeedback, "compact-repair should carry feedback");
    assert.match(retry!.repairFeedback!, /JSON|파싱|문법/);
  });
});
