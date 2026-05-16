import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildReportFromExportSync } from "../src/analysis.js";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "test", "fixtures", "keyword-golden.csv");

describe("keyword audit golden", () => {
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
});
