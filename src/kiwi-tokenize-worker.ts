import { parentPort, workerData } from "node:worker_threads";
import type { UserWord } from "kiwi-nlp";
import { initKiwiRuntime } from "./kiwi-runtime.js";
import { keywordTokensForRecord, type KeywordTokenResult } from "./keyword-record-tokens.js";
import type { ChatRecord } from "./types.js";

interface InitMessage {
  type: "init";
  userWords: UserWord[];
}
interface ProcessMessage {
  type: "process";
  records: ChatRecord[];
}
type WorkerMessage = InitMessage | ProcessMessage | { type: "terminate" };

function send(msg: unknown): void {
  parentPort?.postMessage(msg);
}

// Persistent mode: message-driven lifecycle
if (parentPort) {
  parentPort.on("message", async (msg: WorkerMessage) => {
    try {
      switch (msg.type) {
        case "init":
          await initKiwiRuntime(msg.userWords);
          parentPort!.postMessage({ type: "ready" });
          break;
        case "process": {
          const results: (KeywordTokenResult | null)[] = [];
          for (const record of msg.records) {
            results.push(keywordTokensForRecord(record));
          }
          parentPort!.postMessage({ ok: true, results });
          break;
        }
        case "terminate":
          process.exit(0);
          break;
      }
    } catch (error) {
      parentPort!.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
} else {
  // Legacy one-shot mode: workerData
  const { records, userWords } = workerData as { records: ChatRecord[]; userWords: UserWord[] };
  void (async () => {
    try {
      await initKiwiRuntime(userWords);
      const results: (KeywordTokenResult | null)[] = [];
      for (const record of records) {
        results.push(keywordTokensForRecord(record));
      }
      send({ ok: true as const, results });
    } catch (error) {
      send({
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
