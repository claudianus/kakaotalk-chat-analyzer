import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  getAnalysisProfileSettings,
  resolveAnalysisProfile,
} from "../src/analysis-profile.js";
import { shouldUseAnalyzeWorker } from "../src/analyze-pool.js";

describe("analysis-profile", () => {
  it("defaults to quality profile", () => {
    const prev = process.env.KCA_PROFILE;
    delete process.env.KCA_PROFILE;
    try {
      assert.equal(resolveAnalysisProfile(undefined), "quality");
      const settings = getAnalysisProfileSettings(undefined);
      assert.equal(settings.profile, "quality");
      assert.equal(settings.semanticSupplementRrfWeight, 0.5);
      assert.equal(settings.useEmbeddingTopics, true);
    } finally {
      if (prev === undefined) delete process.env.KCA_PROFILE;
      else process.env.KCA_PROFILE = prev;
    }
  });

  it("worker true or KCA_PROFILE=fast selects fast profile", () => {
    assert.equal(resolveAnalysisProfile({ worker: true }), "fast");
    const prev = process.env.KCA_PROFILE;
    process.env.KCA_PROFILE = "fast";
    try {
      assert.equal(resolveAnalysisProfile(undefined), "fast");
      assert.equal(getAnalysisProfileSettings(undefined).semanticSupplementRrfWeight, 0.85);
    } finally {
      if (prev === undefined) delete process.env.KCA_PROFILE;
      else process.env.KCA_PROFILE = prev;
    }
  });

  it("quality profile does not use worker for 3MB+ CSV", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kca-profile-"));
    const csvPath = join(dir, "big.csv");
    const row = '2026-05-01 09:00:00,"Alice","hello"\n';
    const rows = Math.ceil((3 * 1024 * 1024) / Buffer.byteLength(row, "utf8")) + 2;
    await writeFile(csvPath, row.repeat(rows), "utf8");
    try {
      assert.equal(await shouldUseAnalyzeWorker(csvPath, undefined), false);
      assert.equal(await shouldUseAnalyzeWorker(csvPath, { worker: true }), true);
    } finally {
      const { rm } = await import("node:fs/promises");
      await rm(dir, { recursive: true, force: true });
    }
  });
});
