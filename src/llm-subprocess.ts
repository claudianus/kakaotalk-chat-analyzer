import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LlamaGpuMode } from "./llm-llama-core.js";

export type LlmInferFailureKind = "segfault" | "timeout" | "error";

export interface LlmInferRequest {
  modelPath: string;
  prompt: string;
  maxTokens?: number;
  inferTimeoutMs: number;
  loadTimeoutMs: number;
  gpu: LlamaGpuMode;
  /** JSON Schema for grammar-constrained generation */
  grammarJsonSchema?: unknown;
}

export type LlmInferResponse =
  | { ok: true; text: string }
  | {
      ok: false;
      error: string;
      kind: LlmInferFailureKind;
      exitCode: number | null;
      signal: string | null;
    };

export class LlmInferProcessError extends Error {
  readonly kind: LlmInferFailureKind;
  readonly exitCode: number | null;
  readonly signal: string | null;

  constructor(
    message: string,
    kind: LlmInferFailureKind,
    exitCode: number | null = null,
    signal: string | null = null,
  ) {
    super(message);
    this.name = "LlmInferProcessError";
    this.kind = kind;
    this.exitCode = exitCode;
    this.signal = signal;
  }
}

export function decodeChildFailure(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
): LlmInferFailureKind {
  if (signal === "SIGSEGV" || signal === "SIGBUS" || signal === "SIGABRT") return "segfault";
  if (exitCode === 139 || exitCode === 138 || exitCode === 134) return "segfault";
  return "error";
}

function inferCliPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "llm-infer-cli.js");
}

type SpawnFn = typeof spawn;
let spawnImpl: SpawnFn = spawn;

/** 테스트용 spawn 주입 */
export function __setLlmSpawnForTest(fn: SpawnFn | null): void {
  spawnImpl = fn ?? spawn;
}

function gpuEnv(gpu: LlamaGpuMode): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (gpu === "none") env.KCA_LLM_GPU = "none";
  else if (gpu === "metal") env.KCA_LLM_GPU = "metal";
  else delete env.KCA_LLM_GPU;
  return env;
}

/** 짧은 수명 child에서 GGUF 추론 — 비정상 exit는 ok:false */
export function runLlmInChildProcess(req: LlmInferRequest): Promise<LlmInferResponse> {
  return new Promise((resolve) => {
    const cli = inferCliPath();
    const maxMs = req.loadTimeoutMs + req.inferTimeoutMs + 45_000;
    let settled = false;
    let stdout = "";
    let stderr = "";

    const finish = (res: LlmInferResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawnImpl(process.execPath, [cli], {
        stdio: ["pipe", "pipe", "pipe"],
        env: gpuEnv(req.gpu),
      }) as ChildProcessWithoutNullStreams;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      finish({
        ok: false,
        error: `LLM child spawn failed: ${msg}`,
        kind: "error",
        exitCode: null,
        signal: null,
      });
      return;
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      finish({
        ok: false,
        error: "LLM child timeout",
        kind: "timeout",
        exitCode: null,
        signal: "SIGTERM",
      });
    }, maxMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.stdin.write(JSON.stringify(req));
    child.stdin.end();

    child.on("error", (error) => {
      finish({
        ok: false,
        error: error.message,
        kind: "error",
        exitCode: null,
        signal: null,
      });
    });

    child.on("close", (code, signal) => {
      const line = stdout.trim().split("\n").pop() ?? "";
      if (line) {
        try {
          const parsed = JSON.parse(line) as LlmInferResponse;
          if (parsed.ok) {
            finish(parsed);
            return;
          }
          if (!parsed.ok) {
            finish(parsed);
            return;
          }
        } catch {
          /* fall through */
        }
      }

      if (code === 0) {
        finish({
          ok: false,
          error: stderr.trim() || "LLM child empty stdout",
          kind: "error",
          exitCode: code,
          signal: signal,
        });
        return;
      }

      const kind = decodeChildFailure(code, signal);
      const errMsg =
        stderr.trim() ||
        (kind === "segfault"
          ? "LLM native crash (Metal/GGUF)"
          : `LLM child exit ${code ?? signal ?? "unknown"}`);
      finish({
        ok: false,
        error: errMsg,
        kind,
        exitCode: code,
        signal: signal,
      });
    });
  });
}
