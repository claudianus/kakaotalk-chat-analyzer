#!/usr/bin/env node
/**
 * package.json version ↔ docs pill ↔ demo manifest (fail CI on drift)
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const errors = [];

const docsHtml = readFileSync(join(root, "docs", "index.html"), "utf8");
const pillMatch = docsHtml.match(/<span class="pill">v(\d+\.\d+\.\d+)<\/span>/);
if (!pillMatch) {
  errors.push("docs/index.html: hero version pill not found");
} else if (pillMatch[1] !== version) {
  errors.push(`docs/index.html pill v${pillMatch[1]} !== package.json ${version} (run: npm run sync-docs-version)`);
}

const manifestPath = join(root, "docs", "assets", "demo", "manifest.json");
if (!existsSync(manifestPath)) {
  console.warn("check-docs-version: manifest.json missing (skip until docs:capture-demo)");
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.version !== version) {
    errors.push(
      `docs/assets/demo/manifest.json version ${manifest.version} !== package.json ${version} (run: npm run docs:capture-demo)`,
    );
  }
}

const readme = readFileSync(join(root, "README.md"), "utf8");
const topRow = readme.match(/\|\s*\*\*(\d+\.\d+\.\d+)\*\*\s*\|/);
if (topRow && topRow[1] !== version) {
  errors.push(`README.md 최근 업데이트 top row ${topRow[1]} !== package.json ${version}`);
}

if (errors.length) {
  console.error("check-docs-version FAILED:\n" + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}

console.log(`check-docs-version OK (${version})`);
