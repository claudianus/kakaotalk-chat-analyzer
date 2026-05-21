import { type RunLlamaPromptOptions } from "./llm-llama-core.js";
/** child·in-process 공용 — node-llama-cpp 직접 호출 */
export declare function runLlamaPromptInProcess(options: RunLlamaPromptOptions & {
    grammarJsonSchema?: unknown;
}): Promise<string>;
