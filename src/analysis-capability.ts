import { freemem, totalmem, cpus, platform, arch } from "node:os";
import { probeOnnxGpu } from "./ml-runtime.js";

export type GpuKind = "none" | "cuda" | "dml" | "metal" | "webgpu";

export interface MachineProfile {
  totalMemGb: number;
  freeMemGb: number;
  cpuCores: number;
  platform: NodeJS.Platform;
  arch: string;
  gpu: GpuKind;
}

export function probeMachineProfileSync(): MachineProfile {
  const totalMemGb = totalmem() / 1024 ** 3;
  const freeMemGb = freemem() / 1024 ** 3;
  return {
    totalMemGb: Math.round(totalMemGb * 10) / 10,
    freeMemGb: Math.round(freeMemGb * 10) / 10,
    cpuCores: cpus().length,
    platform: platform(),
    arch: arch(),
    gpu: "none",
  };
}

export async function probeMachineProfile(): Promise<MachineProfile> {
  const base = probeMachineProfileSync();
  const gpu = await probeOnnxGpu();
  return { ...base, gpu };
}

/** preset·코퍼스·RAM 기준 분석 예산(ms) — 5분 SLA 휴리스틱 */
export function analysisBudgetMs(
  preset: string,
  messageCount: number,
  profile: MachineProfile,
): number {
  const sec = estimateAnalysisSeconds(preset, messageCount, profile);
  const cap =
    preset === "speed" ? 180_000 : preset === "balanced" ? 300_000 : preset === "quality" ? 360_000 : 300_000;
  return Math.min(cap, sec * 1000);
}

/** 90k 메시지 기준 대략 예상(초) — preset·RAM 휴리스틱 */
export function estimateAnalysisSeconds(
  preset: string,
  messageCount: number,
  profile: MachineProfile,
): number {
  const n = Math.max(messageCount, 1);
  const base = n / 900;
  const memFactor = profile.freeMemGb < 6 ? 1.4 : profile.freeMemGb < 12 ? 1.1 : 1;
  const presetFactor =
    preset === "speed" ? 0.55 : preset === "balanced" ? 1 : preset === "quality" ? 1.45 : 1.1;
  return Math.round(base * memFactor * presetFactor);
}

export function formatCapabilitiesReport(
  profile: MachineProfile,
  opts?: { preset?: string; messageCount?: number },
): string {
  const lines = [
    `RAM: ${profile.freeMemGb} GiB free / ${profile.totalMemGb} GiB total`,
    `CPU: ${profile.cpuCores} cores · ${profile.platform}/${profile.arch}`,
    `GPU (ONNX): ${profile.gpu}`,
  ];
  if (opts?.preset) {
    lines.push(`Preset: ${opts.preset}`);
    if (opts.messageCount) {
      lines.push(
        `Estimated analysis: ~${estimateAnalysisSeconds(opts.preset, opts.messageCount, profile)}s (${opts.messageCount.toLocaleString("ko-KR")} messages)`,
      );
    }
  }
  return lines.join("\n");
}
