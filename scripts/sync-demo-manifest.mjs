#!/usr/bin/env node
/**
 * package.json version → docs/assets/demo/manifest.json version
 * 데모 이미지는 그대로 두고 버전 스탬프만 맞춘다(데모 UI 변경 없는 릴리스용).
 * 정규식 치환으로 들여쓰기/순서를 보존한다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const manifestPath = join(root, "docs", "assets", "demo", "manifest.json");

if (!existsSync(manifestPath)) {
  console.warn("sync-demo-manifest: manifest.json 없음 — docs:capture-demo 먼저 (skip)");
  process.exit(0);
}

const raw = readFileSync(manifestPath, "utf8");
const re = /("version"\s*:\s*")\d+\.\d+\.\d+(")/;
if (!re.test(raw)) {
  console.error("sync-demo-manifest: version 필드를 찾을 수 없음");
  process.exit(1);
}

const next = raw.replace(re, `$1${version}$2`);
if (next === raw) {
  console.log(`sync-demo-manifest: 이미 ${version}`);
  process.exit(0);
}

writeFileSync(manifestPath, next, "utf8");
console.log(`sync-demo-manifest: manifest.json → ${version}`);
