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
  lines.push(`2024-03-${day} ${hour}:15:00,${sender},"bench message ${i} hello world 한글"`);
}

await writeFile(csvPath, lines.join("\n"), "utf8");

const phases = [
  { label: "no-semantic", opts: { privacy: "public-masked", semanticKeywords: false } },
  { label: "full", opts: { privacy: "public-masked" } },
];

console.log(`rows: ${rows.toLocaleString("ko-KR")}`);
try {
  for (const phase of phases) {
    const t0 = performance.now();
    const data = await buildReportFromExportSync(csvPath, phase.opts);
    const ms = performance.now() - t0;
    console.log(
      `[${phase.label}] ${Math.round(ms)}ms · ${Math.round((rows / ms) * 1000)} rows/s · msgs ${data.summary.totalMessages}`,
    );
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
