import { stat } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
const WORKER_THRESHOLD_BYTES = 3 * 1024 * 1024;
export async function shouldUseAnalyzeWorker(filePath, options) {
    if (options?.worker === false)
        return false;
    if (options?.semanticKeywords === true)
        return false;
    try {
        const { size } = await stat(filePath);
        return size >= WORKER_THRESHOLD_BYTES;
    }
    catch {
        return false;
    }
}
export function runAnalyzeWorker(filePath, options) {
    const workerPath = fileURLToPath(new URL("./analyze-worker.js", import.meta.url));
    return new Promise((resolve, reject) => {
        let settled = false;
        const worker = new Worker(workerPath, {
            workerData: { filePath, options },
        });
        const finish = (error, data) => {
            if (settled)
                return;
            settled = true;
            void worker.terminate();
            if (error)
                reject(error);
            else
                resolve(data);
        };
        worker.once("message", (message) => {
            if (message.ok)
                finish(undefined, message.data);
            else
                finish(new Error(message.error));
        });
        worker.once("error", (error) => finish(error));
        worker.once("exit", (code) => {
            if (!settled && code !== 0) {
                finish(new Error(`analyze worker exited with code ${code}`));
            }
        });
    });
}
//# sourceMappingURL=analyze-pool.js.map