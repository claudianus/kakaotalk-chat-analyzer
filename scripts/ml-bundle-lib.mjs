#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const BUNDLED_SENTIMENT_MODEL_ID = "kca-koelectra-small-v3-nsmc";
export const BUNDLED_EMBED_MODEL_ID = "kca-koelectra-small-v3-embed";
export const BUNDLED_TOXICITY_MODEL_ID = "kca-kcelectra-base-toxicity";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "..");

export function mlBundleCacheDir() {
  const env = process.env.KCA_ML_CACHE?.trim();
  if (env) return join(env, "ml-models");
  return join(homedir(), ".cache", "kakaotalk-chat-analyzer", "ml-models");
}

export function listMlModelRoots() {
  const roots = [];
  try {
    const req = createRequire(join(repoRoot, "package.json"));
    const pkg = req.resolve("kakaotalk-chat-analyzer-models/package.json");
    const dir = join(dirname(pkg), "data", "ml-models");
    if (existsSync(dir)) roots.push(dir);
  } catch {
    /* optional */
  }
  const data = join(repoRoot, "data", "ml-models");
  if (existsSync(data)) roots.push(data);
  const cache = mlBundleCacheDir();
  if (existsSync(cache)) roots.push(cache);
  return [...new Set(roots)];
}

export function modelOnnxReady(root, modelId) {
  return (
    existsSync(join(root, modelId, "config.json")) &&
    existsSync(join(root, modelId, "onnx", "model.onnx"))
  );
}

export function isSentimentBundleReady() {
  return listMlModelRoots().some((r) => modelOnnxReady(r, BUNDLED_SENTIMENT_MODEL_ID));
}

export function isEmbedBundleReady() {
  return listMlModelRoots().some((r) => modelOnnxReady(r, BUNDLED_EMBED_MODEL_ID));
}

export function isToxicityBundleReady() {
  return listMlModelRoots().some((r) => modelOnnxReady(r, BUNDLED_TOXICITY_MODEL_ID));
}

export function readModelsPackageVersion() {
  try {
    const req = createRequire(join(repoRoot, "package.json"));
    const pkg = req.resolve("kakaotalk-chat-analyzer-models/package.json");
    return JSON.parse(readFileSync(pkg, "utf8")).version;
  } catch {
    return process.env.KCA_ML_MODELS_VERSION?.trim() || "0.2.0";
  }
}
