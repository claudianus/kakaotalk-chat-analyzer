#!/usr/bin/env node
/**
 * Export bundled Korean encoder ONNX into kakaotalk-chat-analyzer-models (and local data/).
 *
 * Usage:
 *   node scripts/sync-ml-models.mjs
 *   KCA_ML_MODELS_DIR=./kakaotalk-chat-analyzer-models/data/ml-models node scripts/sync-ml-models.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelsRoot =
  process.env.KCA_ML_MODELS_DIR?.trim() ||
  join(root, "kakaotalk-chat-analyzer-models", "data", "ml-models");

const EXPORTS = [
  {
    id: "kca-koelectra-small-v3-nsmc",
    source: "daekeun-ml/koelectra-small-v3-nsmc",
    task: "text-classification",
  },
  {
    id: "kca-koelectra-small-v3-embed",
    source: "monologg/koelectra-small-v3-discriminator",
    task: "feature-extraction",
  },
  {
    id: "kca-kcelectra-base-toxicity",
    source: "monologg/koelectra-base-v3-discriminator",
    task: "text-classification",
  },
];

function writeModelReadme(entry) {
  const outDir = join(modelsRoot, entry.id);
  mkdirSync(outDir, { recursive: true });
  const readme = `# ${entry.id}

Source: \`${entry.source}\`  
Task: \`${entry.task}\`

\`\`\`bash
optimum-cli export onnx --model ${entry.source} --task ${entry.task} ${outDir}
\`\`\`

Or: \`npm run sync:ml-models\` (requires optimum-cli on PATH)
`;
  writeFileSync(join(outDir, "README.md"), readme, "utf8");
}

function tryOptimumExport(entry) {
  const outDir = join(modelsRoot, entry.id);
  if (existsSync(join(outDir, "config.json"))) {
    console.log(`[sync:ml-models] skip (exists): ${entry.id}`);
    return true;
  }
  const check = spawnSync("optimum-cli", ["--help"], { encoding: "utf8" });
  if (check.status !== 0) return false;
  mkdirSync(outDir, { recursive: true });
  console.log(`[sync:ml-models] exporting ${entry.source} → ${outDir}`);
  const run = spawnSync(
    "optimum-cli",
    ["export", "onnx", "--model", entry.source, "--task", entry.task, outDir],
    { stdio: "inherit", encoding: "utf8" },
  );
  return run.status === 0 && existsSync(join(outDir, "config.json"));
}

function syncManifest() {
  const manifestPath = join(modelsRoot, "manifest.json");
  let manifest = { schema: "kca-ml-models/1", version: "0.1.0", models: [] };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  }
  manifest.models = EXPORTS.map((e) => ({
    id: e.id,
    task: e.task,
    source: e.source,
    bundled: existsSync(join(modelsRoot, e.id, "config.json")),
  }));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function main() {
  mkdirSync(modelsRoot, { recursive: true });
  let exported = 0;
  for (const entry of EXPORTS) {
    writeModelReadme(entry);
    if (tryOptimumExport(entry)) exported += 1;
  }
  syncManifest();
  console.log(`[sync:ml-models] root=${modelsRoot} exported=${exported}/${EXPORTS.length}`);
  if (exported < EXPORTS.length) {
    console.log("[sync:ml-models] optimum-cli missing or export failed — README stubs only.");
  }
}

main();
