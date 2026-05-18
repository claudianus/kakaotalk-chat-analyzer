#!/usr/bin/env node
/**
 * kakaotalk-chat-analyzer-models npm 설치 시도 (postinstall·수동).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isEmbedBundleReady,
  isSentimentBundleReady,
  readModelsPackageVersion,
} from "./ml-bundle-lib.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

export function kcaPackageRoot() {
  try {
    const req = createRequire(join(repoRoot, "package.json"));
    return dirname(req.resolve("kakaotalk-chat-analyzer/package.json"));
  } catch {
    return repoRoot;
  }
}

export function readPinnedModelsVersion() {
  try {
    const req = createRequire(join(repoRoot, "package.json"));
    const main = join(kcaPackageRoot(), "package.json");
    const pkg = JSON.parse(readFileSync(main, "utf8"));
    const dep =
      pkg.dependencies?.["kakaotalk-chat-analyzer-models"] ??
      pkg.optionalDependencies?.["kakaotalk-chat-analyzer-models"];
    if (typeof dep === "string" && dep.length > 0) return dep.replace(/^file:/, "").trim() || readModelsPackageVersion();
  } catch {
    /* fall through */
  }
  return readModelsPackageVersion();
}

/** @returns {boolean} 감정·임베딩 ONNX 모두 준비됨 */
export function installModelsPackageIfNeeded() {
  if (process.env.KCA_NO_ML_AUTO_INSTALL === "1") return isSentimentBundleReady() && isEmbedBundleReady();
  if (isSentimentBundleReady() && isEmbedBundleReady()) return true;

  const ver = readPinnedModelsVersion();
  const cwd = kcaPackageRoot();
  process.stderr.write(`[kca] ML 번들 npm 설치 시도: kakaotalk-chat-analyzer-models@${ver}\n`);

  const run = spawnSync(
    "npm",
    ["install", `kakaotalk-chat-analyzer-models@${ver}`, "--no-save", "--no-audit", "--no-fund"],
    { cwd, stdio: "inherit", env: process.env },
  );
  if (run.status !== 0) {
    process.stderr.write("[kca] ML 번들 npm 설치 실패 — Hub 폴백 또는 네트워크를 확인하세요.\n");
    return false;
  }
  return isSentimentBundleReady() && isEmbedBundleReady();
}
