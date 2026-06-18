import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleLlmUserPrompt,
  buildLlmKeywordMicroExample,
  buildLlmOutputSkeleton,
  buildLlmSystemPrompt,
} from "../src/llm-input.js";
import {
  buildKcaLlmJsonSchemaTier,
  resolveLlmSchemaTier,
} from "../src/llm-schema.js";
import { resolveLlmSamplingForStructured } from "../src/llm-runtime.js";
import { emptyReportData } from "../src/report-empty.js";

test("resolveLlmSchemaTier uses minimal on repair", () => {
  assert.equal(
    resolveLlmSchemaTier({ modelSize: "4B", compact: false, repairAttempt: true }),
    "minimal",
  );
});

test("resolveLlmSchemaTier uses compact for 0.8B primary", () => {
  assert.equal(
    resolveLlmSchemaTier({ modelSize: "0.8B", compact: false, repairAttempt: false }),
    "compact",
  );
});

test("resolveLlmSchemaTier uses full for 4B primary", () => {
  assert.equal(
    resolveLlmSchemaTier({ modelSize: "4B", compact: false, repairAttempt: false }),
    "full",
  );
});

test("buildKcaLlmJsonSchemaTier shrinks property count", () => {
  const minimal = buildKcaLlmJsonSchemaTier("minimal");
  const full = buildKcaLlmJsonSchemaTier("full");
  assert.equal(Object.keys(minimal.properties ?? {}).length, 3);
  assert.ok(Object.keys(full.properties ?? {}).length >= 15);
});

test("buildLlmSystemPrompt includes task checklist", () => {
  const sys = buildLlmSystemPrompt({ tier: "minimal", size: "0.8B" });
  assert.match(sys, /작업 순서/);
  assert.match(sys, /소형 모델/);
  assert.match(sys, /출력 규칙/);
});

test("buildLlmOutputSkeleton embeds room keywords", () => {
  const data = emptyReportData();
  data.keywords = [{ label: "클로드", count: 5 }, { label: "코덱스", count: 3 }];
  const skel = buildLlmOutputSkeleton(data, "minimal");
  assert.match(skel, /클로드/);
  assert.match(skel, /출력 틀/);
});

test("buildLlmKeywordMicroExample uses input keywords", () => {
  const data = emptyReportData();
  data.keywords = [{ label: "야근", count: 2 }, { label: "배포", count: 1 }];
  const ex = buildLlmKeywordMicroExample(data);
  assert.match(ex, /야근/);
  assert.match(ex, /배포/);
});

test("assembleLlmUserPrompt adds skeleton for compact tier", () => {
  const data = emptyReportData();
  data.keywords = [{ label: "테스트", count: 1 }, { label: "키워드", count: 1 }];
  const prompt = assembleLlmUserPrompt(data, { schemaTier: "compact" });
  assert.match(prompt, /출력 틀/);
  assert.match(prompt, /형식 참고/);
});

test("resolveLlmSamplingForStructured lowers temp for 0.8B and repair", () => {
  const primary = resolveLlmSamplingForStructured({ size: "0.8B" });
  const repair = resolveLlmSamplingForStructured({ size: "0.8B", repairAttempt: true });
  assert.ok(primary.temperature < 0.7);
  assert.ok(repair.temperature < primary.temperature);
});
