import { parentPort, workerData } from "node:worker_threads";
import { initKiwiRuntime } from "./kiwi-runtime.js";
import { keywordTokensForRecord } from "./keyword-record-tokens.js";
try {
    const { records, userWords } = workerData;
    await initKiwiRuntime(userWords);
    const results = [];
    for (const record of records) {
        results.push(keywordTokensForRecord(record));
    }
    parentPort?.postMessage({ ok: true, results });
}
catch (error) {
    parentPort?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
//# sourceMappingURL=kiwi-tokenize-worker.js.map