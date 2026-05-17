export type GpuKind = "none" | "cuda" | "dml" | "metal" | "webgpu";
export interface MachineProfile {
    totalMemGb: number;
    /** os.freemem() — 즉시 해제 가능( macOS에서 과소 ) */
    freeMemGb: number;
    /** OS별 가용 추정 — preset·배치·LLM 판단 */
    availableMemGb: number;
    cpuCores: number;
    platform: NodeJS.Platform;
    arch: string;
    gpu: GpuKind;
}
export declare function memoryHeadroomGb(profile: MachineProfile): number;
export declare function probeMachineProfileSync(): MachineProfile;
export declare function probeMachineProfile(): Promise<MachineProfile>;
/** preset·코퍼스·RAM 기준 분석 예산(ms) — 5분 SLA 휴리스틱 */
export declare function analysisBudgetMs(preset: string, messageCount: number, profile: MachineProfile): number;
/** 90k 메시지 기준 대략 예상(초) — preset·RAM 휴리스틱 */
export declare function estimateAnalysisSeconds(preset: string, messageCount: number, profile: MachineProfile): number;
export declare function formatCapabilitiesReport(profile: MachineProfile, opts?: {
    preset?: string;
    messageCount?: number;
}): string;
