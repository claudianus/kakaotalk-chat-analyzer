export declare function phaseProfilingEnabled(): boolean;
export declare class PhaseProfiler {
    private readonly phases;
    private current;
    start(name: string): void;
    end(name?: string): void;
    private endCurrent;
    logSummary(messageCount?: number): void;
}
