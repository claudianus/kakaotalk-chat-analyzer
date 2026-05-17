import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { freemem, totalmem, platform } from "node:os";
function roundGb(bytes) {
    return Math.round((bytes / 1024 ** 3) * 10) / 10;
}
function probeMode() {
    const raw = process.env.KCA_MEMORY_PROBE?.trim().toLowerCase();
    if (raw === "free")
        return "free";
    return "available";
}
/** vm_stat 페이지 수 × page size (darwin) */
export function parseDarwinVmStatPages(vmStatText) {
    let free = 0;
    let inactive = 0;
    let speculative = 0;
    for (const line of vmStatText.split("\n")) {
        const m = line.match(/^\s*Pages\s+(\w+):\s+(\d+)/);
        if (!m)
            continue;
        const n = Number.parseInt(m[2], 10);
        if (m[1] === "free")
            free = n;
        else if (m[1] === "inactive")
            inactive = n;
        else if (m[1] === "speculative")
            speculative = n;
    }
    return { free, inactive, speculative };
}
export function darwinAvailableBytesFromVmStat(vmStatText, pageSize) {
    const { free, inactive, speculative } = parseDarwinVmStatPages(vmStatText);
    return (free + inactive + speculative) * pageSize;
}
function darwinPageSize() {
    try {
        const out = execSync("sysctl -n hw.pagesize", { encoding: "utf8", timeout: 2000 }).trim();
        const n = Number.parseInt(out, 10);
        if (Number.isFinite(n) && n > 0)
            return n;
    }
    catch {
        /* fallback */
    }
    return 4096;
}
function probeDarwinAvailableBytes() {
    try {
        const vmStat = execSync("vm_stat", { encoding: "utf8", timeout: 3000 });
        return darwinAvailableBytesFromVmStat(vmStat, darwinPageSize());
    }
    catch {
        return null;
    }
}
/** Linux MemAvailable (kB) */
export function parseLinuxMemAvailableKb(meminfoText) {
    for (const line of meminfoText.split("\n")) {
        if (line.startsWith("MemAvailable:")) {
            const kb = Number.parseInt(line.split(/\s+/)[1] ?? "", 10);
            if (Number.isFinite(kb) && kb > 0)
                return kb;
        }
    }
    for (const line of meminfoText.split("\n")) {
        if (line.startsWith("MemFree:")) {
            const kb = Number.parseInt(line.split(/\s+/)[1] ?? "", 10);
            if (Number.isFinite(kb) && kb > 0)
                return kb;
        }
    }
    return null;
}
function probeLinuxAvailableBytes() {
    try {
        const text = readFileSync("/proc/meminfo", "utf8");
        const kb = parseLinuxMemAvailableKb(text);
        if (kb === null)
            return null;
        return kb * 1024;
    }
    catch {
        return null;
    }
}
function probeFallbackAvailableBytes() {
    const free = freemem();
    const total = totalmem();
    return Math.max(free, total * 0.15);
}
/** OS별 가용 메모리 추정(바이트). 실패 시 fallback. */
export function probeAvailableMemoryBytes() {
    if (probeMode() === "free")
        return freemem();
    const plat = platform();
    let specific = null;
    if (plat === "darwin")
        specific = probeDarwinAvailableBytes();
    else if (plat === "linux")
        specific = probeLinuxAvailableBytes();
    if (specific !== null && specific > 0)
        return specific;
    return probeFallbackAvailableBytes();
}
export function probeFreeMemoryBytes() {
    return freemem();
}
export function formatMemoryLine(profile) {
    if (Math.abs(profile.availableMemGb - profile.freeMemGb) < 0.3) {
        return `RAM: ${profile.availableMemGb} GiB available / ${profile.totalMemGb} GiB total`;
    }
    return `RAM: ${profile.availableMemGb} GiB available (${profile.freeMemGb} GiB free) / ${profile.totalMemGb} GiB total`;
}
//# sourceMappingURL=memory-probe.js.map