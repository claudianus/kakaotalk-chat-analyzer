import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { buildReportFromExportSync } from "../src/analysis.js";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "keyword-golden.csv");
const VIBE_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test",
  "fixtures",
  "vibecoding-room-sample.csv",
);

describe("keyword audit golden", () => {
  let prevLlm: string | undefined;

  before(() => {
    prevLlm = process.env.KCA_LLM;
    process.env.KCA_LLM = "0";
  });

  after(() => {
    if (prevLlm === undefined) delete process.env.KCA_LLM;
    else process.env.KCA_LLM = prevLlm;
  });

  it("surfaces claude and codex in top keywords for AI-tool chat fixture", async () => {
    const report = await buildReportFromExportSync(FIXTURE, {
      progress: false,
      worker: false,
      semanticKeywords: false,
    });
    const labels = new Set(report.keywords.slice(0, 30).map((k) => k.label));
    const hasClaude = [...labels].some((l) => l.includes("클로드") || l === "claude");
    const hasCodex = [...labels].some((l) => l.includes("코덱스") || l === "codex");
    assert.ok(hasClaude, `expected 클로드 in top30, got: ${[...labels].slice(0, 12).join(", ")}`);
    assert.ok(hasCodex, `expected 코덱스 in top30, got: ${[...labels].slice(0, 12).join(", ")}`);
    assert.ok(report.topics.length >= 1, "expected at least one topic");
  });

  it("vibecoding sample keeps domain terms and drops discourse from top20", async () => {
    const report = await buildReportFromExportSync(VIBE_FIXTURE, {
      progress: false,
      worker: false,
      semanticKeywords: false,
    });
    const top20 = report.keywords.slice(0, 20).map((k) => k.label);
    assert.ok(
      top20.some((l) => l.includes("클로드") || l.includes("코덱스") || l.includes("playwright")),
    );
    assert.equal(top20.includes("감사합니다"), false);
    assert.equal(top20.includes("있어요"), false);
  });

  it("vibecoding sample with semantic on keeps domain terms in top20", async () => {
    if (process.env.KCA_NO_SEMANTIC === "1") return;
    const report = await buildReportFromExportSync(VIBE_FIXTURE, {
      progress: false,
      worker: false,
      semanticKeywords: true,
    });
    const top20 = report.keywords.slice(0, 20).map((k) => k.label);
    assert.ok(
      top20.some((l) => l.includes("클로드") || l.includes("코덱스") || l.includes("playwright")),
      `expected domain terms, got: ${top20.join(", ")}`,
    );
    assert.equal(top20.includes("감사합니다"), false);
    assert.equal(top20.includes("있어요"), false);
  });
});
