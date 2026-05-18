import { stat } from "node:fs/promises";
import { ggufPathForSize } from "./llm-cache.js";
import { pullLlmGguf } from "./llm-pull.js";
import type { Qwen35Size } from "./llm-qwen35.js";

let pullBySize = new Map<Qwen35Size, Promise<boolean>>();

/** node-llama-cpp용 Qwen3.5 GGUF — 없으면 Hugging Face에서 자동 pull */
export async function ensureLlmGgufReady(size: Qwen35Size): Promise<boolean> {
  if (process.env.KCA_NO_LLM_AUTO_PULL === "1") {
    try {
      await stat(ggufPathForSize(size));
      return true;
    } catch {
      return false;
    }
  }

  let pending = pullBySize.get(size);
  if (!pending) {
    pending = (async () => {
      const path = ggufPathForSize(size);
      try {
        const st = await stat(path);
        if (st.size > 0) return true;
      } catch {
        /* pull */
      }
      try {
        await pullLlmGguf(size);
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[kca] Qwen3.5 GGUF 자동 다운로드 실패: ${msg}\n`);
        return false;
      }
    })();
    pullBySize.set(size, pending);
  }
  return pending;
}
