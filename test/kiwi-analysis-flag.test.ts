import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildReportFromExport, buildReportFromExportSync } from "../src/analysis.js";
import { buildReportProvenance } from "../src/report-provenance.js";

const FIXTURE = join(process.cwd(), "test/fixtures/keyword-golden.csv");

test("buildReportFromExport records kiwiAvailableAtAnalysis on aggregating thread", async () => {
  if (process.env.KCA_NO_KIWI === "1") return;

  const data = await buildReportFromExport(FIXTURE, {
    privacy: "public-masked",
    worker: false,
    progress: false,
  });
  assert.equal(data.kiwiAvailableAtAnalysis, true);

  const p = buildReportProvenance(data, {
    privacy: "public-masked",
    top: 40,
    workerUsed: false,
    kiwiAvailable: data.kiwiAvailableAtAnalysis === true,
  });
  assert.equal(p.analysis.kiwiAvailable, true);
});

test("worker path sets kiwiAvailableAtAnalysis inside worker", async () => {
  if (process.env.KCA_NO_KIWI === "1") return;

  const dir = await mkdtemp(join(tmpdir(), "kca-worker-kiwi-"));
  const csvPath = join(dir, "big.csv");
  const row = '2026-05-01 09:00:00,"Alice","hello kiwi morph test"\n';
  const rows = Math.ceil((3 * 1024 * 1024) / Buffer.byteLength(row, "utf8")) + 2;
  await writeFile(csvPath, row.repeat(rows), "utf8");

  try {
    const data = await buildReportFromExport(csvPath, {
      privacy: "public-masked",
      worker: undefined,
      progress: false,
      semanticKeywords: false,
    });
    assert.equal(data.kiwiAvailableAtAnalysis, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
