#!/usr/bin/env node
/**
 * CSV에서 샵검색 알림·태그 추출 감사
 *
 * Usage:
 *   npm run build && node scripts/shop-search-audit.mjs [csv-path]
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { splitMessageForAnalysis, extractShopSearchTag } from "../dist/src/system-notices.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = process.argv[2] || join(root, "test/fixtures/keyword-golden.csv");

function loadMessages(path) {
  const raw = readFileSync(path, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return rows
    .map((row) => String(row.Message ?? row.message ?? "").trim())
    .filter((msg) => msg.length > 0);
}

function main() {
  const messages = loadMessages(csvPath);
  let notices = 0;
  let tagged = 0;
  let untagged = 0;
  const tagCounts = new Map();
  const missSamples = [];

  for (const msg of messages) {
    if (!msg.includes("샵검색")) continue;
    const split = splitMessageForAnalysis(msg);
    const shopLines = msg.split("\n").filter((l) => /샵검색/u.test(l));
    for (const line of shopLines) {
      if (!/샵검색/u.test(line)) continue;
      notices += 1;
      const tag = extractShopSearchTag(line);
      if (tag) {
        tagged += 1;
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      } else {
        untagged += 1;
        if (missSamples.length < 10) missSamples.push(line.trim().slice(0, 100));
      }
    }
    if (split.shopSearchTags.length) {
      for (const t of split.shopSearchTags) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
  }

  const unique = tagCounts.size;
  const extractions = [...tagCounts.values()].reduce((a, n) => a + n, 0);
  console.log(`shop-search-audit: ${csvPath}`);
  console.log(`lines with 샵검색: ${notices} · tagged: ${tagged} · untagged: ${untagged}`);
  console.log(`unique tags: ${unique} · extraction sum: ${extractions}`);
  if (missSamples.length) {
    console.log("miss samples:");
    for (const s of missSamples) console.log(`  - ${s}`);
  }
  const top = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (top.length) {
    console.log("top tags:", top.map(([t, c]) => `${t}(${c})`).join(", "));
  }
}

main();
