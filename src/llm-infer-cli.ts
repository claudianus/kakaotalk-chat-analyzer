#!/usr/bin/env node
/**
 * LLM 추론 전용 child — SIGSEGV 시 부모 프로세스 보호.
 * stdin: LlmInferRequest JSON 한 줄
 * stdout: LlmInferResponse JSON 한 줄
 */
import { readFileSync } from "node:fs";
import type { LlmInferRequest, LlmInferResponse } from "./llm-subprocess.js";
import { runLlamaPromptInProcess } from "./llm-infer-internal.js";

function writeResponse(res: LlmInferResponse): void {
  process.stdout.write(`${JSON.stringify(res)}\n`);
}

async function main(): Promise<void> {
  const raw = readFileSync(0, "utf8").trim();
  if (!raw) {
    writeResponse({ ok: false, error: "empty stdin", kind: "error", exitCode: 1, signal: null });
    process.exit(1);
    return;
  }
  let req: LlmInferRequest;
  try {
    req = JSON.parse(raw) as LlmInferRequest;
  } catch {
    writeResponse({ ok: false, error: "invalid JSON stdin", kind: "error", exitCode: 1, signal: null });
    process.exit(1);
    return;
  }

  if (req.gpu === "none") process.env.KCA_LLM_GPU = "none";
  else if (req.gpu === "metal") process.env.KCA_LLM_GPU = "metal";
  else delete process.env.KCA_LLM_GPU;

  try {
    const text = await runLlamaPromptInProcess({
      modelPath: req.modelPath,
      prompt: req.prompt,
      maxTokens: req.maxTokens,
      inferTimeoutMs: req.inferTimeoutMs,
      loadTimeoutMs: req.loadTimeoutMs,
    });
    writeResponse({ ok: true, text });
    process.exit(0);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const kind = msg.toLowerCase().includes("timeout") ? "timeout" : "error";
    writeResponse({ ok: false, error: msg, kind, exitCode: 1, signal: null });
    process.exit(1);
  }
}

main();
