import type { Qwen35Size } from "./llm-qwen35.js";
/** node-llama-cpp용 Qwen3.5 GGUF — 없으면 Hugging Face에서 자동 pull */
export declare function ensureLlmGgufReady(size: Qwen35Size): Promise<boolean>;
