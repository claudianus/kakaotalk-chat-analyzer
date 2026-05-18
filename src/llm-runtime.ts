import { platform } from "node:os";

export type LlamaGpuMode = "none" | "metal" | "auto";

/** `KCA_LLM_GPU`: none | metal | auto (기본 auto) */
export function resolveLlamaGpuMode(): LlamaGpuMode {
  const raw = process.env.KCA_LLM_GPU?.trim().toLowerCase();
  if (raw === "none" || raw === "cpu" || raw === "false" || raw === "0") return "none";
  if (raw === "metal" || raw === "gpu" || raw === "1") return "metal";
  return "auto";
}

/** macOS 26+ Metal tensor 프로브 실패 시 stderr·비활성 완화 */
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

type GetLlamaFn = (options?: { gpu?: false }) => Promise<{
  loadModel: (opts: { modelPath: string }) => Promise<LlamaModelLike>;
}>;

interface LlamaModelLike {
  createContext: (opts: { contextSize: number }) => Promise<LlamaContextLike>;
  dispose?: () => Promise<void>;
}

interface LlamaContextLike {
  getSequence: () => unknown;
  dispose?: () => Promise<void>;
}

/** node-llama-cpp `getLlama` — auto 시 Metal 실패하면 CPU 1회 재시도 */
export async function getLlamaForKca(): Promise<Awaited<ReturnType<GetLlamaFn>>> {
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
}

function raceTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error(label)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  });
}

/** GGUF 로드 → 채팅 1회 → 리소스 해제 (로드·추론 타임아웃 분리) */
export async function runLlamaPrompt(options: RunLlamaPromptOptions): Promise<string> {
  const { modelPath, prompt, maxTokens = 768, inferTimeoutMs, loadTimeoutMs } = options;
  const mod = "node-llama-cpp";
  const { LlamaChatSession } = await import(mod);
  const llama = await getLlamaForKca();

  let model: LlamaModelLike | undefined;
  let context: LlamaContextLike | undefined;
  try {
    model = await raceTimeout(
      llama.loadModel({ modelPath }),
      loadTimeoutMs,
      "LLM load timeout",
    );
    context = await raceTimeout(
      model.createContext({ contextSize: 4096 }),
      Math.min(loadTimeoutMs, 30_000),
      "LLM context timeout",
    );
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });
    const reply = await raceTimeout(
      session.prompt(prompt, { maxTokens }),
      inferTimeoutMs,
      "LLM timeout",
    );
    return typeof reply === "string" ? reply : String(reply);
  } finally {
    await context?.dispose?.();
    await model?.dispose?.();
  }
}
