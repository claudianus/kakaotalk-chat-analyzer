export interface ReportProgressUpdate {
  phase: string;
  current: number;
  total?: number;
}

let lastPrintedPct = -1;
let lastPhase = "";

export function logReportProgress(update: ReportProgressUpdate): void {
  const { phase, current, total } = update;
  if (total !== undefined && total > 0) {
    const pct = Math.min(99, Math.round((current / total) * 100));
    if (phase === lastPhase && pct === lastPrintedPct && current < total) return;
    lastPhase = phase;
    lastPrintedPct = pct;
    process.stderr.write(
      `[kca] ${phase} ${pct}% (${current.toLocaleString("ko-KR")}/${total.toLocaleString("ko-KR")}건)\n`,
    );
    if (current >= total) lastPrintedPct = -1;
    return;
  }
  lastPhase = phase;
  lastPrintedPct = -1;
  process.stderr.write(`[kca] ${phase}… ${current.toLocaleString("ko-KR")}\n`);
}

export function resetReportProgress(): void {
  lastPrintedPct = -1;
  lastPhase = "";
}
