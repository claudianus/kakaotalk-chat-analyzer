import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { UserWord } from "kiwi-nlp";
import type { ReportAggregator } from "./aggregator.js";
import { iterateSpoolRecords } from "./analysis-spool.js";
import type { SpoolKeywordPassOptions } from "./analysis-spool.js";
import { keywordTokensForRecord } from "./keyword-record-tokens.js";
import { resolveKiwiWorkerCount, kiwiWorkerPoolEnabled } from "./kiwi-worker-config.js";
import { recordOnOrAfter } from "./report-date-filter.js";
import type { ChatRecord } from "./types.js";
import type { KeywordTokenResult } from "./keyword-record-tokens.js";

function runTokenizeWorker(records: ChatRecord[], userWords: UserWord[]): Promise<(KeywordTokenResult | null)[]> {
  const workerPath = fileURLToPath(new URL("./kiwi-tokenize-worker.js", import.meta.url));
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { records, userWords },
    });
    let settled = false;
    const finish = (error?: Error, results?: (KeywordTokenResult | null)[]) => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      if (error) reject(error);
      else resolve(results!);
    };
    worker.once(
      "message",
      (msg: { ok: true; results: (KeywordTokenResult | null)[] } | { ok: false; error: string }) => {
        if (msg.ok) finish(undefined, msg.results);
        else finish(new Error(msg.error));
      },
    );
    worker.once("error", (err) => finish(err));
    worker.once("exit", (code) => {
      if (!settled && code !== 0) finish(new Error(`kiwi tokenize worker exited ${code}`));
    });
  });
}

function applyTokenResults(agg: ReportAggregator, results: (KeywordTokenResult | null)[]): void {
  for (const row of results) {
    if (!row) continue;
    agg.applyKeywordTokens(row.tokens, row.monthKey);
  }
}

async function runKeywordPassSequential(
  records: ChatRecord[],
  agg: ReportAggregator,
  opts?: SpoolKeywordPassOptions,
): Promise<void> {
  const progressEvery = opts?.progressEvery ?? 25_000;
  const onProgress = opts?.onProgress;
  let count = 0;
  for (const record of records) {
    const row = keywordTokensForRecord(record);
    if (row) agg.applyKeywordTokens(row.tokens, row.monthKey);
    count += 1;
    if (onProgress && count % progressEvery === 0) onProgress(count);
  }
}

export async function runKeywordPassFromSpoolPooled(
  spoolPath: string,
  agg: ReportAggregator,
  userWords: UserWord[],
  messageCount: number,
  opts?: SpoolKeywordPassOptions,
): Promise<void> {
  const since = opts?.since;
  const records: ChatRecord[] = [];
  for await (const record of iterateSpoolRecords(spoolPath)) {
    if (since && !recordOnOrAfter(record, since)) continue;
    records.push(record);
  }

  const workerCount = resolveKiwiWorkerCount();
  if (!kiwiWorkerPoolEnabled(workerCount, messageCount)) {
    await runKeywordPassSequential(records, agg, opts);
    return;
  }

  const chunkSize = Math.ceil(records.length / workerCount);
  const chunks: ChatRecord[][] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  const progressEvery = opts?.progressEvery ?? 25_000;
  const onProgress = opts?.onProgress;
  let processed = 0;

  const results = await Promise.all(chunks.map((chunk) => runTokenizeWorker(chunk, userWords)));
  for (const batch of results) {
    applyTokenResults(agg, batch);
    processed += batch.length;
    if (onProgress && processed % progressEvery < chunkSize) {
      onProgress(Math.min(processed, records.length));
    }
  }
  if (onProgress) onProgress(records.length);
}
