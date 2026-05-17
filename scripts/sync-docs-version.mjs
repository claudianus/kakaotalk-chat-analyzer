#!/usr/bin/env node
/**
 * package.json version → docs/index.html hero pill (v0.x.y)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const docsPath = join(root, "docs", "index.html");
let html = readFileSync(docsPath, "utf8");

const pillRe = /(<span class="pill">)v\d+\.\d+\.\d+(<\/span>)/;
if (!pillRe.test(html)) {
  console.error("sync-docs-version: hero version pill not found in docs/index.html");
  process.exit(1);
}

html = html.replace(pillRe, `$1v${version}$2`);
writeFileSync(docsPath, html, "utf8");
console.log(`sync-docs-version: docs/index.html pill → v${version}`);
