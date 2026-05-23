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

// New design: version in hero-badge: "v0.22.3 · Node.js 22+"
// Fallback: old design: <span class="pill">v0.22.3</span>
const badgeRe = /(<div class="hero-badge">[\s\S]*?)v\d+\.\d+\.\d+(\s*·)/;
const pillRe = /(<span class="pill">)v\d+\.\d+\.\d+(<\/span>)/;

if (badgeRe.test(html)) {
  html = html.replace(badgeRe, `$1v${version}$2`);
  console.log(`sync-docs-version: docs/index.html badge → v${version}`);
} else if (pillRe.test(html)) {
  html = html.replace(pillRe, `$1v${version}$2`);
  console.log(`sync-docs-version: docs/index.html pill → v${version}`);
} else {
  console.error("sync-docs-version: version not found in docs/index.html");
  process.exit(1);
}

writeFileSync(docsPath, html, "utf8");
