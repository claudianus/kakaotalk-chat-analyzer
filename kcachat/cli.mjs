#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const kcachatRoot = dirname(fileURLToPath(import.meta.url));
const wrapperVersion = JSON.parse(readFileSync(join(kcachatRoot, "package.json"), "utf8")).version;

const rawArgs = process.argv.slice(2);
const useBundled =
  process.env.KCA_BUNDLED === "1" || rawArgs.includes("--bundled");
const args = rawArgs.filter((a) => a !== "--bundled");

function resolveBundled() {
  const pkgPath = require.resolve("kakaotalk-chat-analyzer/package.json");
  const root = dirname(pkgPath);
  return {
    version: JSON.parse(readFileSync(pkgPath, "utf8")).version,
    cli: join(root, "dist", "src", "cli.js"),
  };
}

function spawnNpxLatest(forwardArgs) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  return spawnSync(npx, ["--yes", "--prefer-online", "kakaotalk-chat-analyzer@latest", ...forwardArgs], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
}

function runBundled(forwardArgs) {
  let target;
  try {
    target = resolveBundled().cli;
  } catch {
    console.error(
      '[kcachat] 번들된 "kakaotalk-chat-analyzer"를 찾지 못했습니다. npm i kcachat 후 다시 시도하거나 --bundled 없이 실행해 주세요.',
    );
    process.exit(1);
  }
  return spawnSync(process.execPath, [target, ...forwardArgs], {
    stdio: "inherit",
    env: process.env,
  });
}

if (args.includes("--version") || args.includes("-V")) {
  console.log(`kcachat ${wrapperVersion}`);
  if (useBundled) {
    try {
      console.log(`kakaotalk-chat-analyzer ${resolveBundled().version} (bundled)`);
    } catch {
      console.error('[kcachat] bundled 본체를 찾지 못했습니다.');
      process.exit(1);
    }
    process.exit(0);
  }
  const result = spawnNpxLatest(["--version"]);
  process.exit(result.status ?? 1);
}

const result = useBundled ? runBundled(args) : spawnNpxLatest(args);
process.exit(result.status ?? 1);
