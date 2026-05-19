import { spawn } from "node:child_process";
import type { LlamaGpuMode } from "./llm-llama-core.js";
export type LlmInferFailureKind = "segfault" | "timeout" | "error";
export interface LlmInferRequest {
    modelPath: string;
    prompt: string;
    maxTokens?: number;
    inferTimeoutMs: number;
    loadTimeoutMs: number;
    gpu: LlamaGpuMode;
}
export type LlmInferResponse = {
    ok: true;
    text: string;
} | {
    ok: false;
    error: string;
    kind: LlmInferFailureKind;
    exitCode: number | null;
    signal: string | null;
};
export declare class LlmInferProcessError extends Error {
    readonly kind: LlmInferFailureKind;
    readonly exitCode: number | null;
    readonly signal: string | null;
    constructor(message: string, kind: LlmInferFailureKind, exitCode?: number | null, signal?: string | null);
}
export declare function decodeChildFailure(exitCode: number | null, signal: NodeJS.Signals | null): LlmInferFailureKind;
type SpawnFn = typeof spawn;
/** 테스트용 spawn 주입 */
export declare function __setLlmSpawnForTest(fn: SpawnFn | null): void;
/** 짧은 수명 child에서 GGUF 추론 — 비정상 exit는 ok:false */
export declare function runLlmInChildProcess(req: LlmInferRequest): Promise<LlmInferResponse>;
export {};
