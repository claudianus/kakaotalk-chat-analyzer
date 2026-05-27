import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { iterateSpoolRecords } from "./analysis-spool.js";
import { keywordTokensForRecord } from "./keyword-record-tokens.js";
import { resolveKiwiWorkerCount, kiwiWorkerPoolEnabled } from "./kiwi-worker-config.js";
import { recordOnOrAfter } from "./report-date-filter.js";
const WORKER_TIMEOUT_MS = 60_000;
/** Kiwi Worker Pool — 워커를 미리 생성하고 Kiwi 모델을 한 번만 로드하여 재사용 */
class KiwiWorkerPool {
    workers = [];
    ready = 0;
    workerPath;
    constructor(count) {
        this.workerPath = fileURLToPath(new URL("./kiwi-tokenize-worker.js", import.meta.url));
        for (let i = 0; i < count; i += 1) {
            this.workers.push(new Worker(this.workerPath));
        }
    }
    /** 모든 워커에 Kiwi 모델을 로드하고 준비될 때까지 대기 */
    async init(userWords) {
        const pending = [];
        for (const worker of this.workers) {
            pending.push(new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("kiwi worker init timed out")), WORKER_TIMEOUT_MS);
                const onMsg = (msg) => {
                    if (msg.type === "ready") {
                        clearTimeout(timeout);
                        worker.off("message", onMsg);
                        worker.off("error", onErr);
                        this.ready += 1;
                        resolve();
                    }
                };
                const onErr = (err) => {
                    clearTimeout(timeout);
                    reject(err);
                };
                worker.on("message", onMsg);
                worker.once("error", onErr);
                worker.postMessage({ type: "init", userWords });
            }));
        }
        await Promise.all(pending);
    }
    /** 워커 하나에 레코드 청크를 보내고 결과를 받음 */
    process(workerIndex, records) {
        const worker = this.workers[workerIndex];
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("kiwi worker process timed out")), WORKER_TIMEOUT_MS);
            const onMsg = (msg) => {
                clearTimeout(timeout);
                worker.off("message", onMsg);
                if (msg.ok)
                    resolve(msg.results);
                else
                    reject(new Error(msg.error ?? "kiwi worker error"));
            };
            worker.on("message", onMsg);
            worker.once("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            worker.postMessage({ type: "process", records });
        });
    }
    terminate() {
        for (const worker of this.workers) {
            try {
                worker.postMessage({ type: "terminate" });
            }
            catch {
                // worker may already be dead
            }
            void worker.terminate();
        }
        this.workers = [];
    }
}
function applyTokenResults(agg, results) {
    for (const row of results) {
        if (!row)
            continue;
        agg.applyKeywordTokens(row.tokens, row.monthKey);
    }
}
async function runKeywordPassSequential(records, agg, opts) {
    const progressEvery = opts?.progressEvery ?? 25_000;
    const onProgress = opts?.onProgress;
    let count = 0;
    for (const record of records) {
        const row = keywordTokensForRecord(record);
        if (row)
            agg.applyKeywordTokens(row.tokens, row.monthKey);
        count += 1;
        if (onProgress && count % progressEvery === 0)
            onProgress(count);
    }
}
export async function runKeywordPassFromSpoolPooled(spoolPath, agg, userWords, messageCount, opts) {
    const since = opts?.since;
    const records = [];
    for await (const record of iterateSpoolRecords(spoolPath)) {
        if (since && !recordOnOrAfter(record, since))
            continue;
        records.push(record);
    }
    const workerCount = resolveKiwiWorkerCount();
    if (!kiwiWorkerPoolEnabled(workerCount, messageCount)) {
        await runKeywordPassSequential(records, agg, opts);
        return;
    }
    const chunkSize = Math.ceil(records.length / workerCount);
    const chunks = [];
    for (let i = 0; i < records.length; i += chunkSize) {
        chunks.push(records.slice(i, i + chunkSize));
    }
    const progressEvery = opts?.progressEvery ?? 25_000;
    const onProgress = opts?.onProgress;
    let processed = 0;
    const pool = new KiwiWorkerPool(workerCount);
    try {
        await pool.init(userWords);
        const tasks = chunks.map((chunk, i) => pool.process(i, chunk));
        const results = await Promise.all(tasks);
        for (const batch of results) {
            applyTokenResults(agg, batch);
            processed += batch.length;
            if (onProgress && processed % progressEvery < chunkSize) {
                onProgress(Math.min(processed, records.length));
            }
        }
    }
    finally {
        pool.terminate();
    }
    if (onProgress)
        onProgress(records.length);
}
//# sourceMappingURL=kiwi-keyword-pool.js.map