import type { MachineProfile } from "./analysis-capability.js";
import type { Qwen35Size } from "./llm-qwen35.js";
import type { LlamaGpuMode } from "./llm-llama-core.js";
/** 사용자 env 우선, 없으면 post-ML free RAM 기반 안전 기본값 */
export declare function resolveLlmGpuForInfer(profile: MachineProfile, size: Qwen35Size): LlamaGpuMode;
