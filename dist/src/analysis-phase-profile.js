import { performance } from "node:perf_hooks";
export function phaseProfilingEnabled() {
    return process.env.KCA_PROFILE_PHASES === "1";
}
export class PhaseProfiler {
    phases = new Map();
    current = null;
    start(name) {
        if (!phaseProfilingEnabled())
            return;
        this.endCurrent();
        this.current = { name, start: performance.now() };
    }
    end(name) {
        if (!phaseProfilingEnabled())
            return;
        if (!this.current)
            return;
        if (name && this.current.name !== name)
            return;
        const elapsed = performance.now() - this.current.start;
        this.phases.set(this.current.name, (this.phases.get(this.current.name) ?? 0) + elapsed);
        this.current = null;
    }
    endCurrent() {
        if (!this.current)
            return;
        const elapsed = performance.now() - this.current.start;
        this.phases.set(this.current.name, (this.phases.get(this.current.name) ?? 0) + elapsed);
        this.current = null;
    }
    logSummary(messageCount) {
        if (!phaseProfilingEnabled())
            return;
        this.endCurrent();
        const rows = [...this.phases.entries()].sort((a, b) => b[1] - a[1]);
        const total = rows.reduce((s, [, ms]) => s + ms, 0);
        process.stderr.write(`[kca] phase profile (${messageCount?.toLocaleString("ko-KR") ?? "?"} messages)\n`);
        for (const [name, ms] of rows) {
            const pct = total > 0 ? Math.round((ms / total) * 100) : 0;
            const rate = messageCount && messageCount > 0 && ms > 0
                ? ` · ${Math.round(messageCount / (ms / 1000)).toLocaleString("ko-KR")} msg/s`
                : "";
            process.stderr.write(`  ${name}: ${Math.round(ms)}ms (${pct}%)${rate}\n`);
        }
        process.stderr.write(`  total: ${Math.round(total)}ms\n`);
    }
}
//# sourceMappingURL=analysis-phase-profile.js.map