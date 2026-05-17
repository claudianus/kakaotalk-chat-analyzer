import { parentPort, workerData } from "node:worker_threads";
import { buildReportFromExportSync } from "./analysis.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import type { ReportData } from "./types.js";

interface WorkerPayload {
  filePath: string;
  options?: BuildReportOptions;
}

try {
  const { filePath, options } = workerData as WorkerPayload;
  const data: ReportData = await buildReportFromExportSync(filePath, options);
  parentPort?.postMessage({ ok: true as const, data });
} catch (error) {
  parentPort?.postMessage({
    ok: false as const,
    error: error instanceof Error ? error.message : String(error),
  });
}
