#!/usr/bin/env node
/**
 * KoELECTRA-Small v3 임베딩 ONNX 변환 안내
 *
 * Usage: npm run convert:embedding-onnx
 * 권장: npm run sync:ml-models
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelsDir = join(root, "data", "ml-models", "kca-koelectra-small-v3-embed");
const sourceModel = "monologg/koelectra-small-v3-discriminator";

const readme = `# kca-koelectra-small-v3-embed (로컬 ONNX)

1. pip install "optimum[onnxruntime]" onnx transformers
2. optimum-cli export onnx --model ${sourceModel} --task feature-extraction ${modelsDir}

또는 저장소 루트에서: npm run sync:ml-models

Hub 런타임 폴백: ${sourceModel} (quality) / daekeun-ml/koelectra-small-v3-korsts (balanced)

벤치: npm run bench:semantic
`;

if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });
writeFileSync(join(modelsDir, "README.md"), readme, "utf8");
console.log(`Wrote ${join(modelsDir, "README.md")}`);
