#!/usr/bin/env node
/**
 * 주제·키워드 회귀 스냅샷 (golden + vibecoding)
 * Usage: npm run build && node scripts/topic-coherence-audit.mjs
 */
import { spawnSync } from "node:child_process";

const r = spawnSync("node", ["scripts/keyword-audit.mjs"], {
  stdio: "inherit",
  cwd: process.cwd(),
});
process.exit(r.status ?? 1);
