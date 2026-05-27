import { parentPort, workerData } from "node:worker_threads";
import { initKiwiRuntime } from "./kiwi-runtime.js";
import { keywordTokensForRecord } from "./keyword-record-tokens.js";
function send(msg) {
    parentPort?.postMessage(msg);
}
// Persistent mode: message-driven lifecycle
if (parentPort) {
    parentPort.on("message", async (msg) => {
        try {
            switch (msg.type) {
                case "init":
                    await initKiwiRuntime(msg.userWords);
                    parentPort.postMessage({ type: "ready" });
                    break;
                case "process": {
                    const results = [];
                    for (const record of msg.records) {
                        results.push(keywordTokensForRecord(record));
                    }
                    parentPort.postMessage({ ok: true, results });
                    break;
                }
                case "terminate":
                    process.exit(0);
                    break;
            }
        }
        catch (error) {
            parentPort.postMessage({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
}
else {
    // Legacy one-shot mode: workerData
    const { records, userWords } = workerData;
    void (async () => {
        try {
            await initKiwiRuntime(userWords);
            const results = [];
            for (const record of records) {
                results.push(keywordTokensForRecord(record));
            }
            send({ ok: true, results });
        }
        catch (error) {
            send({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    })();
}
//# sourceMappingURL=kiwi-tokenize-worker.js.map