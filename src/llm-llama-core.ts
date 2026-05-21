import { platform } from "node:os";
import { getKcaLlmGrammar } from "./llm-grammar.js";

export type LlamaGpuMode = "none" | "metal" | "auto";

/** `KCA_LLM_GPU`: none | metal | auto (기본 auto) */
export function resolveLlamaGpuMode(): LlamaGpuMode {
  const raw = process.env.KCA_LLM_GPU?.trim().toLowerCase();
  if (raw === "none" || raw === "cpu" || raw === "false" || raw === "0") return "none";
  if (raw === "metal" || raw === "gpu" || raw === "1") return "metal";
  return "auto";
}

/** macOS Metal tensor 프로브 실패 시 stderr·비활성 완화 */
export function applyGgmlMetalCompatibilityEnv(): void {
  if (resolveLlamaGpuMode() === "metal") return;
  if (platform() !== "darwin") return;
  if (process.env.GGML_METAL_TENSOR_DISABLE != null) return;
  process.env.GGML_METAL_TENSOR_DISABLE = "1";
}

let cpuFallbackNotified = false;

function notifyCpuFallback(): void {
  if (cpuFallbackNotified) return;
  cpuFallbackNotified = true;
  process.stderr.write("[kca] LLM: Metal 비활성 → CPU 추론 (macOS 호환)\n");
}

function isMetalInitFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes("metal") ||
    lower.includes("ggml") ||
    lower.includes("gpu") ||
    lower.includes("mps")
  );
}

type LlamaBinding = {
  loadModel: (opts: { modelPath: string }) => Promise<LlamaModelLike>;
  createGrammarForJsonSchema: (schema: unknown) => Promise<LlamaGrammarLike>;
};

type GetLlamaFn = (options?: { gpu?: false }) => Promise<LlamaBinding>;

interface LlamaGrammarLike {
  parse: (json: string) => unknown;
}

interface LlamaModelLike {
  createContext: (opts: { contextSize: number }) => Promise<LlamaContextLike>;
  dispose?: () => Promise<void>;
}

interface LlamaContextLike {
  getSequence: () => unknown;
  dispose?: () => Promise<void>;
}

/** node-llama-cpp `getLlama` — auto 시 Metal 실패하면 CPU 1회 재시도 */
export async function getLlamaForKca(): Promise<LlamaBinding> {
  applyGgmlMetalCompatibilityEnv();
  const mod = "node-llama-cpp";
  const { getLlama } = (await import(mod)) as { getLlama: GetLlamaFn };
  const mode = resolveLlamaGpuMode();

  if (mode === "none") {
    return getLlama({ gpu: false });
  }

  try {
    return await getLlama();
  } catch (error) {
    if (mode === "metal") throw error;
    if (!isMetalInitFailure(error)) throw error;
    notifyCpuFallback();
    return getLlama({ gpu: false });
  }
}

export interface RunLlamaPromptOptions {
  modelPath: string;
  prompt: string;
  maxTokens?: number;
  /** 추론 단계 상한(ms) */
  inferTimeoutMs: number;
  /** GGUF 로드+컨텍스트 생성 상한(ms) */
  loadTimeoutMs: number;
  gpu?: LlamaGpuMode;
  /** JSON Schema for grammar-constrained generation (bypasses cached grammar) */
  grammarJsonSchema?: unknown;
}

/** Qwen3.5 instruct(non-thinking) 기본 — env로 override */
export function resolveLlmSamplingParams(): {
  temperature: number;
  topP: number;
  topK: number;
} {
  const temp = Number(process.env.KCA_LLM_TEMPERATURE);
  const topP = Number(process.env.KCA_LLM_TOP_P);
  const topK = Number(process.env.KCA_LLM_TOP_K);
  return {
    temperature: Number.isFinite(temp) && temp >= 0 ? temp : 0.7,
    topP: Number.isFinite(topP) && topP > 0 && topP <= 1 ? topP : 0.8,
    topK: Number.isFinite(topK) && topK >= 0 ? topK : 20,
  };
}

export { getKcaLlmGrammar };
export type { LlamaModelLike, LlamaContextLike, LlamaBinding };
