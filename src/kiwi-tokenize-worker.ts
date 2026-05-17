import { parentPort, workerData } from "node:worker_threads";
import type { UserWord } from "kiwi-nlp";
import { initKiwiRuntime } from "./kiwi-runtime.js";
import { keywordTokensForRecord, type KeywordTokenResult } from "./keyword-record-tokens.js";
import type { ChatRecord } from "./types.js";

interface TokenizeWorkerPayload {
  records: ChatRecord[];
  userWords: UserWord[];
}

try {
  const { records, userWords } = workerData as TokenizeWorkerPayload;
  await initKiwiRuntime(userWords);
  const results: (KeywordTokenResult | null)[] = [];
  for (const record of records) {
    results.push(keywordTokensForRecord(record));
  }
  parentPort?.postMessage({ ok: true as const, results });
} catch (error) {
  parentPort?.postMessage({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  });
}
