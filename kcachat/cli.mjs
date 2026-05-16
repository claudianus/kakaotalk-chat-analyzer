#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const kcachatRoot = dirname(fileURLToPath(import.meta.url));

function resolveMain() {
  const pkgPath = require.resolve("kakaotalk-chat-analyzer/package.json");
  const root = dirname(pkgPath);
  return {
    version: JSON.parse(readFileSync(pkgPath, "utf8")).version,
    cli: join(root, "dist", "src", "cli.js"),
  };
}

const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-V")) {
  let main;
  try {
    main = resolveMain();
  } catch {
    console.error('[kcachat] "kakaotalk-chat-analyzer"를 불러오지 못했습니다.');
    process.exit(1);
  }
  const wrapper = JSON.parse(readFileSync(join(kcachatRoot, "package.json"), "utf8")).version;
  console.log(`kcachat ${wrapper}`);
  console.log(`kakaotalk-chat-analyzer ${main.version}`);
  process.exit(0);
}

let target;
try {
  target = resolveMain().cli;
} catch {
  console.error('[kcachat] "kakaotalk-chat-analyzer"를 불러오지 못했습니다. npm i kcachat 후 다시 실행해 주세요.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [target, ...args], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
