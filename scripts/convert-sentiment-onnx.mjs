#!/usr/bin/env node
/**
 * KoELECTRA-Small-v3 NSMC 감정 ONNX 변환
 *
 * Usage:
 *   npm run convert:sentiment-onnx
 *   KCA_SENTIMENT_EXPORT_MODEL=daekeun-ml/koelectra-small-v3-nsmc npm run convert:sentiment-onnx
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "ml-models", "kca-koelectra-small-v3-nsmc");
const sourceModel =
  process.env.KCA_SENTIMENT_EXPORT_MODEL?.trim() || "daekeun-ml/koelectra-small-v3-nsmc";

function writeReadme() {
  const readme = `# kca-koelectra-small-v3-nsmc (로컬 ONNX)

NSMC KoELECTRA-Small v3 감정 모델 (@xenova/transformers 용 ONNX).

## 변환

\`\`\`bash
optimum-cli export onnx \\
  --model ${sourceModel} \\
  --task text-classification \\
  data/ml-models/kca-koelectra-small-v3-nsmc
\`\`\`

또는: \`npm run convert:sentiment-onnx\` / \`npm run sync:ml-models\`

원본: ${sourceModel}
`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "README.md"), readme, "utf8");
}

function tryOptimumExport() {
  const check = spawnSync("optimum-cli", ["--help"], { encoding: "utf8" });
  if (check.status !== 0) return false;

  mkdirSync(outDir, { recursive: true });
  console.log(`[convert:sentiment-onnx] exporting ${sourceModel} → ${outDir}`);
  const run = spawnSync(
    "optimum-cli",
    ["export", "onnx", "--model", sourceModel, "--task", "text-classification", outDir],
    { stdio: "inherit", encoding: "utf8" },
  );
  return run.status === 0;
}

function main() {
  writeReadme();
  if (existsSync(join(outDir, "config.json"))) {
    console.log(`[convert:sentiment-onnx] already present: ${outDir}/config.json`);
    return;
  }
  if (tryOptimumExport()) {
    console.log(`[convert:sentiment-onnx] done: ${outDir}`);
    return;
  }
  console.log(`Wrote ${join(outDir, "README.md")}`);
  console.log("optimum-cli not found or export failed — run sync:ml-models or README steps.");
}

main();
