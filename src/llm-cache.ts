import { homedir } from "node:os";
import { join } from "node:path";
import { qwen35Entry, type Qwen35Size } from "./llm-qwen35.js";

export { QWEN35_CATALOG, QWEN35_SERIES_LABEL, qwen35DisplayLabel } from "./llm-qwen35.js";

export function llmCacheRoot(): string {
  return process.env.KCA_LLM_CACHE?.trim() || join(homedir(), ".cache", "kakaotalk-chat-analyzer", "llm");
}

export function ggufPathForSize(size: Qwen35Size): string {
  const custom = process.env.KCA_LLM_GGUF_PATH?.trim();
  if (custom) return custom;
  const { file } = qwen35Entry(size).gguf;
  return join(llmCacheRoot(), size, file);
}

export function hfDownloadUrl(repo: string, file: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}
