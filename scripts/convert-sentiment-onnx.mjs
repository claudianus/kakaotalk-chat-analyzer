#!/usr/bin/env node
/**
 * 한국어 감정 ONNX 변환 (로컬 data/ml-models — git에 .onnx 미포함 가능)
 *
 * Usage:
 *   npm run convert:sentiment-onnx
 *   KCA_SENTIMENT_EXPORT_MODEL=FISA-conclave/klue-roberta-news-sentiment npm run convert:sentiment-onnx
 *
 * Python 3.10+:
 *   pip install "optimum[onnxruntime]" onnx transformers
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "ml-models", "kca-koelectra-korean-sentiment");
const sourceModel =
  process.env.KCA_SENTIMENT_EXPORT_MODEL?.trim() || "cringepnh/koelectra-korean-sentiment";

function writeReadme() {
  const readme = `# kca-koelectra-korean-sentiment (로컬 ONNX)

NSMC 계열 한국어 이진 감정 모델을 @xenova/transformers 용 ONNX로 변환합니다.

## 변환

\`\`\`bash
python3 -m venv .venv-sentiment
source .venv-sentiment/bin/activate
pip install "optimum[onnxruntime]" onnx transformers
optimum-cli export onnx \\
  --model ${sourceModel} \\
  --task text-classification \\
  ${outDir}
\`\`\`

또는: \`npm run convert:sentiment-onnx\` (optimum-cli 가 PATH 에 있으면 자동 실행)

## 사용

변환 후 quality preset 이 \`kca-koelectra-korean-sentiment\` 로컬 모델을 우선 사용합니다.
이진 출력은 \`KCA_SENTIMENT_BINARY_HIGH\`(기본 0.72) 미만 confidence 를 neutral 로 매핑합니다.

원본: ${sourceModel} (MIT)
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
  console.log("optimum-cli not found or export failed — run the Python steps in that README.");
}

main();
