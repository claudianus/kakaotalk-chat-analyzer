import { stat } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { resolveAnalysisProfile } from "./analysis-profile.js";
import { getPresetEffectiveFlags } from "./analysis-preset.js";
const WORKER_THRESHOLD_BYTES = 3 * 1024 * 1024;
export async function shouldUseAnalyzeWorker(filePath, options) {
    if (options?.worker === false)
        return false;
    if (options?.semanticKeywords === true)
        return false;
    if (options?.sentiment === true)
        return false;
    const presetFlags = getPresetEffectiveFlags(options);
    const profile = resolveAnalysisProfile(options);
    const wantWorker = options?.worker === true || presetFlags.preferWorker || profile === "fast";
    if (!wantWorker)
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
        const timeout = setTimeout(() => {
            if (!settled)
                finish(new Error("analyze worker timed out after 30s"));
        }, 30_000);
        const cleanup = () => {
            clearTimeout(timeout);
        };
        const finish = (error, data) => {
            if (settled)
                return;
            settled = true;
            cleanup();
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
            if (!settled) {
                cleanup();
                finish(new Error(code !== 0
                    ? `analyze worker exited with code ${code}`
                    : `analyze worker exited without sending result`));
            }
        });
    });
}
//# sourceMappingURL=analyze-pool.js.map