import { freemem, totalmem, cpus, platform, arch } from "node:os";
import {
  formatMemoryLine,
  probeAvailableMemoryBytes,
  probeFreeMemoryBytes,
} from "./memory-probe.js";
import { resolveLlmRunPlan } from "./llm-resolve.js";
import { qwen35DisplayLabel } from "./llm-qwen35.js";
import { probeOnnxGpu } from "./ml-runtime.js";

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

export function memoryHeadroomGb(profile: MachineProfile): number {
  return profile.availableMemGb ?? profile.freeMemGb;
}

export function probeMachineProfileSync(): MachineProfile {
  const totalMemGb = totalmem() / 1024 ** 3;
  const freeMemGb = probeFreeMemoryBytes() / 1024 ** 3;
  const availableMemGb = probeAvailableMemoryBytes() / 1024 ** 3;
  return {
    totalMemGb: Math.round(totalMemGb * 10) / 10,
    freeMemGb: Math.round(freeMemGb * 10) / 10,
    availableMemGb: Math.round(availableMemGb * 10) / 10,
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

/** preset·RAM 기준 분석 SLA 상한(ms). 코퍼스 추정 시간과 무관하게 고정 — 단계 skip은 경과 시간으로 판단 */
export function analysisBudgetMs(
  preset: string,
  _messageCount: number,
  profile: MachineProfile,
): number {
  const headroom = memoryHeadroomGb(profile);
  let cap =
    preset === "speed" ? 180_000 : preset === "balanced" ? 300_000 : preset === "quality" ? 360_000 : 300_000;
  if (headroom >= 16) {
    if (preset === "quality") cap = 420_000;
    else if (preset === "balanced") cap = 360_000;
    else if (preset === "speed") cap = 210_000;
  }
  return cap;
}

/** 90k 메시지 기준 대략 예상(초) — preset·RAM 휴리스틱 */
export function estimateAnalysisSeconds(
  preset: string,
  messageCount: number,
  profile: MachineProfile,
): number {
  const n = Math.max(messageCount, 1);
  const base = n / 900;
  const headroom = memoryHeadroomGb(profile);
  const memFactor = headroom < 6 ? 1.4 : headroom < 12 ? 1.1 : 1;
  const presetFactor =
    preset === "speed" ? 0.55 : preset === "balanced" ? 1 : preset === "quality" ? 1.45 : 1.1;
  return Math.max(1, Math.round(base * memFactor * presetFactor));
}

export function formatCapabilitiesReport(
  profile: MachineProfile,
  opts?: { preset?: string; messageCount?: number },
): string {
  const lines = [
    formatMemoryLine(profile),
    `CPU: ${profile.cpuCores} cores · ${profile.platform}/${profile.arch}`,
    `GPU (ONNX): ${profile.gpu}`,
  ];
  if (opts?.preset) {
    lines.push(`Preset: ${opts.preset}`);
    const llmPlan = resolveLlmRunPlan({
      preset: opts.preset as "speed" | "balanced" | "quality" | "custom",
      profile,
      messageCount: opts.messageCount,
    });
    if (llmPlan.enabled && llmPlan.size) {
      lines.push(`LLM: ${qwen35DisplayLabel(llmPlan.size)} (${llmPlan.reason})`);
    } else {
      lines.push(`LLM: off (${llmPlan.reason})`);
    }
    if (opts.messageCount) {
      lines.push(
        `Estimated analysis: ~${estimateAnalysisSeconds(opts.preset, opts.messageCount, profile)}s (${opts.messageCount.toLocaleString("ko-KR")} messages)`,
      );
    }
  }
  return lines.join("\n");
}
