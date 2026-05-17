import { cpus } from "node:os";
import { probeMachineProfileSync } from "./analysis-capability.js";

/** Kiwi spool 병렬 토큰화 worker 수 (1 = 비활성, 메인 스레드만) */
export function resolveKiwiWorkerCount(): number {
  if (process.env.KCA_NO_KIWI === "1" || process.env.KCA_NO_KIWI_WORKERS === "1") return 1;

  const forced = process.env.KCA_KIWI_WORKERS?.trim();
  if (forced) {
    const n = Number.parseInt(forced, 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(16, n);
  }

  const profile = probeMachineProfileSync();
  if (profile.freeMemGb < 8) return 1;

  const cores = profile.cpuCores || cpus().length;
  const byMem = profile.freeMemGb >= 16 ? 4 : profile.freeMemGb >= 12 ? 3 : 2;
  return Math.max(1, Math.min(byMem, Math.max(1, cores - 1)));
}

export function kiwiWorkerPoolEnabled(workerCount: number, messageCount: number): boolean {
  return workerCount > 1 && messageCount >= 2_000;
}
