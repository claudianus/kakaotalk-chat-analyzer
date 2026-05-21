#!/usr/bin/env node
/**
 * Export bundled Korean encoder ONNX into data/ml-models (+ models npm package).
 *
 * Usage:
 *   npm run sync:ml-models
 *
 * Requires: .venv-ml (auto-created) or optimum-cli on PATH
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TOXICITY_ONNX_ASSET = "kca-kcelectra-base-toxicity-onnx.zip";
const KURE_ONNX_ASSET = "kca-kure-v1-onnx.zip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL_ROOTS = [
  join(root, "data", "ml-models"),
  join(root, "kakaotalk-chat-analyzer-models", "data", "ml-models"),
];

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
  {
    id: "kca-kure-v1",
    source: "nlpai-lab/KURE-v1",
    task: "feature-extraction",
  },
  // 2026-05: SOTA 교체 후보 (Hub 직접 로드 우선, ONNX 변환은 별도 검증)
  {
    id: "kca-granite-embed-97m",
    source: "ibm-granite/granite-embedding-97m-multilingual-r2",
    task: "feature-extraction",
  },
  {
    id: "kca-krelectra-small",
    source: "snunlp/KR-ELECTRA-small",
    task: "text-classification",
  },
  {
    id: "kca-kcelectra-toxic-detector",
    source: "jinkyeongk/kcELECTRA-toxic-detector",
    task: "text-classification",
  },
];

/** npm `kakaotalk-chat-analyzer-models` tarball — Legacy + 신규 소형 모델 */
const NPM_EXPORTS = EXPORTS.filter(
  (e) => !["kca-kcelectra-base-toxicity", "kca-kure-v1", "kca-granite-embed-97m"].includes(e.id),
);

function optimumCli() {
  const venv = join(root, ".venv-ml", "bin", "optimum-cli");
  if (existsSync(venv)) return venv;
  return "optimum-cli";
}

/** @xenova/transformers 는 onnx/model.onnx (+ 외부 가중치 model.onnx_data) 경로를 기대 */
function fixOnnxLayout(modelDir) {
  const nestedDir = join(modelDir, "onnx");
  mkdirSync(nestedDir, { recursive: true });
  for (const name of ["model.onnx", "model.onnx_data"]) {
    const flat = join(modelDir, name);
    const nested = join(nestedDir, name);
    if (!existsSync(flat) || existsSync(nested)) continue;
    cpSync(flat, nested);
    try {
      unlinkSync(flat);
    } catch {
      /* ignore */
    }
  }
}

function writeModelReadme(entry, outDir) {
  mkdirSync(outDir, { recursive: true });
  const readme = `# ${entry.id}

Source: \`${entry.source}\`  
Task: \`${entry.task}\`

\`\`\`bash
npm run sync:ml-models
\`\`\`
`;
  writeFileSync(join(outDir, "README.md"), readme, "utf8");
}

function tryOptimumExport(entry, outDir) {
  if (existsSync(join(outDir, "config.json")) && existsSync(join(outDir, "onnx", "model.onnx"))) {
    console.log(`[sync:ml-models] skip (exists): ${entry.id}`);
    return true;
  }
  const cli = optimumCli();
  const check = spawnSync(cli, ["--help"], { encoding: "utf8" });
  if (check.status !== 0) {
    console.error(`[sync:ml-models] ${cli} not found — run: python3 -m venv .venv-ml && .venv-ml/bin/pip install "optimum[onnxruntime]" onnx transformers torch`);
    return false;
  }
  mkdirSync(outDir, { recursive: true });
  console.log(`[sync:ml-models] exporting ${entry.source} → ${outDir}`);
  const run = spawnSync(
    cli,
    ["export", "onnx", "--model", entry.source, "--task", entry.task, outDir],
    { stdio: "inherit", encoding: "utf8" },
  );
  if (run.status !== 0) return false;
  fixOnnxLayout(outDir);
  return existsSync(join(outDir, "config.json")) && existsSync(join(outDir, "onnx", "model.onnx"));
}

function syncManifest(modelsRoot, entries, version = "0.2.0") {
  const manifestPath = join(modelsRoot, "manifest.json");
  const manifest = {
    schema: "kca-ml-models/1",
    version,
    bundled: entries === NPM_EXPORTS,
    models: entries.map((e) => ({
      id: e.id,
      task: e.task,
      source: e.source,
      bundled: existsSync(join(modelsRoot, e.id, "onnx", "model.onnx")),
    })),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function pruneModelsPackage(modelsRoot) {
  for (const id of ["kca-kcelectra-base-toxicity", "kca-kure-v1"]) {
    const dir = join(modelsRoot, id);
    if (!existsSync(dir)) continue;
    rmSync(dir, { recursive: true, force: true });
    console.log(`[sync:ml-models] removed ${id} from npm package tree: ${modelsRoot}`);
  }
}

function copyNpmModelsToPackage(primaryRoot, secondaryRoot) {
  if (primaryRoot === secondaryRoot) return;
  pruneModelsPackage(secondaryRoot);
  for (const entry of NPM_EXPORTS) {
    const src = join(primaryRoot, entry.id);
    const dest = join(secondaryRoot, entry.id);
    if (!existsSync(join(src, "onnx", "model.onnx"))) continue;
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
    console.log(`[sync:ml-models] copied ${entry.id} → ${secondaryRoot}`);
  }
}

function createKureReleaseZip(primaryRoot) {
  const kureId = "kca-kure-v1";
  const kureDir = join(primaryRoot, kureId);
  const onnx = join(kureDir, "onnx", "model.onnx");
  const onnxData = join(kureDir, "onnx", "model.onnx_data");
  if (!existsSync(onnx) || !existsSync(onnxData)) {
    console.warn("[sync:ml-models] KURE ONNX missing; skip release zip");
    return null;
  }
  const zipPath = join(root, KURE_ONNX_ASSET);
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  const run = spawnSync("zip", ["-r", zipPath, kureId], {
    cwd: primaryRoot,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    console.error("[sync:ml-models] KURE zip failed:", run.stderr || run.stdout);
    return null;
  }
  console.log(`[sync:ml-models] release asset: ${zipPath}`);
  return zipPath;
}

function createToxicityReleaseZip(primaryRoot) {
  const toxicId = "kca-kcelectra-base-toxicity";
  const toxicDir = join(primaryRoot, toxicId);
  if (!existsSync(join(toxicDir, "onnx", "model.onnx"))) {
    console.warn("[sync:ml-models] toxicity ONNX missing; skip release zip");
    return null;
  }
  const zipPath = join(root, TOXICITY_ONNX_ASSET);
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  const run = spawnSync("zip", ["-r", zipPath, toxicId], {
    cwd: primaryRoot,
    encoding: "utf8",
  });
  if (run.status !== 0) {
    console.error("[sync:ml-models] zip failed:", run.stderr || run.stdout);
    return null;
  }
  console.log(`[sync:ml-models] release asset: ${zipPath}`);
  return zipPath;
}

function main() {
  const primaryRoot = MODEL_ROOTS[0];
  mkdirSync(primaryRoot, { recursive: true });
  let exported = 0;
  for (const entry of EXPORTS) {
    const outDir = join(primaryRoot, entry.id);
    writeModelReadme(entry, outDir);
    if (tryOptimumExport(entry, outDir)) exported += 1;
    else fixOnnxLayout(outDir);
  }
  syncManifest(primaryRoot, EXPORTS);
  copyNpmModelsToPackage(primaryRoot, MODEL_ROOTS[1]);
  syncManifest(MODEL_ROOTS[1], NPM_EXPORTS);
  createToxicityReleaseZip(primaryRoot);
  createKureReleaseZip(primaryRoot);
  const totalMb = spawnSync("du", ["-sh", primaryRoot], { encoding: "utf8" });
  console.log(`[sync:ml-models] root=${primaryRoot} exported=${exported}/${EXPORTS.length} size=${(totalMb.stdout || "").trim()}`);
  if (exported < EXPORTS.length) {
    process.exitCode = 1;
  }
}

main();
