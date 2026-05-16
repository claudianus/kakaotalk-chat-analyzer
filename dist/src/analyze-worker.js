import { parentPort, workerData } from "node:worker_threads";
import { buildReportFromExportSync } from "./analysis.js";
try {
    const { filePath, options } = workerData;
    const data = await buildReportFromExportSync(filePath, options);
    parentPort?.postMessage({ ok: true, data });
}
catch (error) {
    parentPort?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
//# sourceMappingURL=analyze-worker.js.map