import { stat } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import type { PrivacyMode, ReportData } from "./types.js";

const WORKER_THRESHOLD_BYTES = 3 * 1024 * 1024;

export interface BuildReportOptions {
  privacy?: PrivacyMode;
  top?: number;
  /** false면 메인 스레드만 사용 */
  worker?: boolean;
  /** 집계 중 진행 건수 stderr 출력 */
  progress?: boolean;
  /** true=강제, false=끔, undefined=한국어 방이면 자동 */
  semanticKeywords?: boolean;
  /** YYYY-MM-DD — 이 날짜(포함) 이후 메시지만 집계 */
  since?: string;
}

export async function shouldUseAnalyzeWorker(
  filePath: string,
  options?: BuildReportOptions,
): Promise<boolean> {
  if (options?.worker === false) return false;
  if (options?.semanticKeywords === true) return false;
  try {
    const { size } = await stat(filePath);
    return size >= WORKER_THRESHOLD_BYTES;
  } catch {
    return false;
  }
}

export function runAnalyzeWorker(filePath: string, options?: BuildReportOptions): Promise<ReportData> {
  const workerPath = fileURLToPath(new URL("./analyze-worker.js", import.meta.url));
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerPath, {
      workerData: { filePath, options },
    });

    const finish = (error?: Error, data?: ReportData) => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      if (error) reject(error);
      else resolve(data!);
    };

    worker.once("message", (message: { ok: true; data: ReportData } | { ok: false; error: string }) => {
      if (message.ok) finish(undefined, message.data);
      else finish(new Error(message.error));
    });
    worker.once("error", (error) => finish(error));
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(new Error(`analyze worker exited with code ${code}`));
      }
    });
  });
}
