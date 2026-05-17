export type MemoryProbeMode = "available" | "free";
/** vm_stat 페이지 수 × page size (darwin) */
export declare function parseDarwinVmStatPages(vmStatText: string): {
    free: number;
    inactive: number;
    speculative: number;
};
export declare function darwinAvailableBytesFromVmStat(vmStatText: string, pageSize: number): number;
/** Linux MemAvailable (kB) */
export declare function parseLinuxMemAvailableKb(meminfoText: string): number | null;
/** OS별 가용 메모리 추정(바이트). 실패 시 fallback. */
export declare function probeAvailableMemoryBytes(): number;
export declare function probeFreeMemoryBytes(): number;
export declare function formatMemoryLine(profile: {
    freeMemGb: number;
    availableMemGb: number;
    totalMemGb: number;
}): string;
