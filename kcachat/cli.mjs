#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
let target;
try {
  const pkgPath = require.resolve("kakaotalk-chat-analyzer/package.json");
  const root = dirname(pkgPath);
  target = join(root, "dist", "src", "cli.js");
} catch {
  console.error('[kcachat] "kakaotalk-chat-analyzer"를 불러오지 못했습니다. npm i kcachat 후 다시 실행해 주세요.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
