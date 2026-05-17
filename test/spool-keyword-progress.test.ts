import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runKeywordPassFromSpool } from "../src/analysis.js";
import { ReportAggregator } from "../src/aggregator.js";
import type { ChatRecord } from "../src/types.js";

function sampleRecord(line: number): ChatRecord {
  return {
    line,
    rawDate: "2026-02-01 09:00:00",
    date: { year: 2026, month: 2, day: 1, hour: 9, minute: 0, second: 0 },
    sender: "A",
    message: `키워드 테스트 메시지 ${line}`,
  };
}

test("runKeywordPassFromSpool reports progress at progressEvery intervals", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-spool-kw-"));
  const spoolPath = join(dir, "messages.ndjson");
  const lines = Array.from({ length: 1_200 }, (_, i) => JSON.stringify(sampleRecord(i + 1)));
  await writeFile(spoolPath, `${lines.join("\n")}\n`, "utf8");

  const agg = new ReportAggregator(spoolPath, "public-masked", 30);
  const hits: number[] = [];
  try {
    await runKeywordPassFromSpool(spoolPath, agg, {
      progressEvery: 500,
      onProgress: (n) => hits.push(n),
    });
    assert.deepEqual(hits, [500, 1000]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
