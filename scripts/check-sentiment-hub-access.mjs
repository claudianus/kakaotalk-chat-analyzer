#!/usr/bin/env node
/**
 * 감정 모델 Hub 익명 접근 스모크 (config.json HEAD)
 *
 * Usage: npm run check:sentiment-hub
 */
import { spawnSync } from "node:child_process";
import { DEFAULT_SENTIMENT_MODEL } from "../dist/src/sentiment-policy.js";
import { SENTIMENT_HUB_ANONYMOUS_BLOCKLIST } from "../dist/src/sentiment-hub-registry.js";

const MUST_WORK = [DEFAULT_SENTIMENT_MODEL];
const MUST_FAIL = [...SENTIMENT_HUB_ANONYMOUS_BLOCKLIST];

function headStatus(modelId) {
  const url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
  const r = spawnSync("curl", ["-sI", "-o", "/dev/null", "-w", "%{http_code}", url], {
    encoding: "utf8",
  });
  return (r.stdout || "").trim();
}

function main() {
  let failed = false;
  for (const id of MUST_WORK) {
    const code = headStatus(id);
    const ok = code === "307" || code === "302" || code === "200";
    console.log(`${ok ? "OK" : "FAIL"} ${code} ${id}`);
    if (!ok) failed = true;
  }
  for (const id of MUST_FAIL) {
    const code = headStatus(id);
    const blocked = code === "401" || code === "403";
    console.log(`${blocked ? "blocked" : "WARN"} ${code} ${id}`);
    if (!blocked) failed = true;
  }
  if (failed) process.exit(1);
}

main();
