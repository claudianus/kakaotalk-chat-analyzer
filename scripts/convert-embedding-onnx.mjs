#!/usr/bin/env node
/**
 * ko-v2 임베딩 ONNX 변환 안내 (로컬 models/ — git LFS 제외)
 *
 * 실제 변환은 Python optimum/onnxruntime 환경에서 수행합니다.
 * 완료 후 KCA_SEMANTIC_MODEL=./models/ko-e5-v2-onnx 로 지정하세요.
 *
 * Usage: npm run convert:embedding-onnx
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelsDir = join(root, "models", "ko-e5-v2-onnx");

const readme = `# ko-v2 ONNX (로컬)

1. Python 3.10+ venv
2. pip install optimum[onnxruntime] onnx transformers sentence-transformers
3. optimum-cli export onnx --model dragonkue/multilingual-e5-small-ko-v2 --task feature-extraction ${modelsDir}

또는 Xenova 네임스페이스에 호스팅된 ONNX가 있으면 semantic-policy QUALITY_KOREAN_SEMANTIC_MODEL 을 갱신하세요.

벤치: KCA_BENCH_PRESET=quality npm run bench:semantic
`;

if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });
writeFileSync(join(modelsDir, "README.md"), readme, "utf8");
console.log(`Wrote ${join(modelsDir, "README.md")}`);
console.log("Run the Python optimum-cli steps in that README to produce ONNX artifacts.");
