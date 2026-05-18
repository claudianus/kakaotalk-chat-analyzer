import { type Qwen35Size } from "./llm-qwen35.js";
export declare function parsePullSize(raw: string): Qwen35Size;
export declare function pullLlmGguf(size: Qwen35Size): Promise<string>;
