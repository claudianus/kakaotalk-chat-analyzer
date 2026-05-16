#!/usr/bin/env node
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReportFromExportSync } from "../dist/src/analysis.js";

const rows = Number(process.argv[2] ?? 50_000);
const dir = await mkdtemp(join(tmpdir(), "kca-bench-"));
const csvPath = join(dir, "bench.csv");

const lines = ["Date,User,Message"];
const senders = ["Alice", "Bob", "Charlie", "Dana"];
for (let i = 0; i < rows; i += 1) {
  const day = String((i % 28) + 1).padStart(2, "0");
  const hour = String(i % 24).padStart(2, "0");
  const sender = senders[i % senders.length];
  lines.push(`2024-03-${day} ${hour}:15:00,${sender},"bench message ${i} hello world"`);
}

await writeFile(csvPath, lines.join("\n"), "utf8");

const t0 = performance.now();
const data = await buildReportFromExportSync(csvPath, { privacy: "public-masked" });
const ms = performance.now() - t0;

console.log(`rows: ${rows.toLocaleString("ko-KR")}`);
console.log(`messages: ${data.summary.totalMessages.toLocaleString("ko-KR")}`);
console.log(`elapsed: ${Math.round(ms)}ms`);
console.log(`rate: ${Math.round((rows / ms) * 1000).toLocaleString("ko-KR")} rows/s`);

await rm(dir, { recursive: true, force: true });
