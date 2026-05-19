import {
  createWriteStream,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_EMBED_MODEL_ID,
  BUNDLED_KURE_MODEL_ID,
  BUNDLED_SENTIMENT_MODEL_ID,
  BUNDLED_TOXICITY_MODEL_ID,
} from "./ml-bundle-ids.js";

export const TOXICITY_ONNX_ASSET = "kca-kcelectra-base-toxicity-onnx.zip";
export const KURE_ONNX_ASSET = "kca-kure-v1-onnx.zip";
const DEFAULT_REPO = "claudianus/kakaotalk-chat-analyzer";

export function mlBundleCacheDir(): string {
  const env = process.env.KCA_ML_CACHE?.trim();
  if (env) return join(env, "ml-models");
  return join(homedir(), ".cache", "kakaotalk-chat-analyzer", "ml-models");
}

export function readModelsPackageVersion(): string {
  try {
    const req = createRequire(import.meta.url);
    const pkg = req.resolve("kakaotalk-chat-analyzer-models/package.json");
    return JSON.parse(readFileSync(pkg, "utf8")).version as string;
  } catch {
    return process.env.KCA_ML_MODELS_VERSION?.trim() || "0.2.0";
  }
}

export function toxicityReleaseTag(): string {
  const env = process.env.KCA_ML_MODELS_RELEASE?.trim();
  if (env) return env;
  return `ml-models-v${readModelsPackageVersion()}`;
}

export function toxicityReleaseAssetUrl(): string {
  const repo = process.env.KCA_ML_MODELS_REPO?.trim() || DEFAULT_REPO;
  const tag = toxicityReleaseTag();
  return `https://github.com/${repo}/releases/download/${tag}/${TOXICITY_ONNX_ASSET}`;
}

export function kureReleaseAssetUrl(): string {
  const repo = process.env.KCA_ML_MODELS_REPO?.trim() || DEFAULT_REPO;
  const tag = toxicityReleaseTag();
  return `https://github.com/${repo}/releases/download/${tag}/${KURE_ONNX_ASSET}`;
}

function modelOnnxReady(root: string, modelId: string): boolean {
  return (
    existsSync(join(root, modelId, "config.json")) &&
    existsSync(join(root, modelId, "onnx", "model.onnx"))
  );
}

function kureOnnxReady(root: string): boolean {
  return (
    modelOnnxReady(root, BUNDLED_KURE_MODEL_ID) &&
    existsSync(join(root, BUNDLED_KURE_MODEL_ID, "onnx", "model.onnx_data"))
  );
}

export function isSentimentBundleReady(): boolean {
  return listMlModelRoots().some((r) => modelOnnxReady(r, BUNDLED_SENTIMENT_MODEL_ID));
}

export function isEmbedBundleReady(): boolean {
  return listMlModelRoots().some((r) => modelOnnxReady(r, BUNDLED_EMBED_MODEL_ID));
}

export function isToxicityBundleReady(): boolean {
  return listMlModelRoots().some((r) => modelOnnxReady(r, BUNDLED_TOXICITY_MODEL_ID));
}

export function isKureBundleReady(): boolean {
  return listMlModelRoots().some((r) => kureOnnxReady(r));
}

export function isCoreBundleReady(): boolean {
  return isSentimentBundleReady() && isEmbedBundleReady();
}

/** npm models 패키지 → monorepo data → user cache */
export function listMlModelRoots(): string[] {
  const roots: string[] = [];
  try {
    const req = createRequire(import.meta.url);
    const pkg = req.resolve("kakaotalk-chat-analyzer-models/package.json");
    const dir = join(dirname(pkg), "data", "ml-models");
    if (existsSync(dir)) roots.push(dir);
  } catch {
    /* not installed */
  }
  const pkgData = join(fileURLToPath(new URL("..", import.meta.url)), "..", "data", "ml-models");
  if (existsSync(pkgData)) roots.push(pkgData);
  const cache = mlBundleCacheDir();
  if (existsSync(cache)) roots.push(cache);
  return [...new Set(roots)];
}

export function resolveMlModelRootFor(modelId: string): string | undefined {
  for (const root of listMlModelRoots()) {
    if (modelOnnxReady(root, modelId)) return root;
  }
  return undefined;
}

function extractZip(zipPath: string, destDir: string): boolean {
  mkdirSync(destDir, { recursive: true });
  const tar = spawnSync("tar", ["-xf", zipPath, "-C", destDir], { encoding: "utf8" });
  if (tar.status === 0) return true;
  const unzip = spawnSync("unzip", ["-q", "-o", zipPath, "-d", destDir], { encoding: "utf8" });
  return unzip.status === 0;
}

let toxicityDownloadPromise: Promise<boolean> | null = null;
let kureDownloadPromise: Promise<boolean> | null = null;

/** GitHub Release 에서 독성 ONNX zip 다운로드 → cache */
export async function ensureToxicityBundle(): Promise<boolean> {
  if (isToxicityBundleReady()) return true;
  if (process.env.KCA_NO_TOXICITY_DOWNLOAD === "1") return false;
  if (!toxicityDownloadPromise) {
    toxicityDownloadPromise = downloadToxicityBundle().finally(() => {
      if (!isToxicityBundleReady()) toxicityDownloadPromise = null;
    });
  }
  return toxicityDownloadPromise;
}

async function downloadToxicityBundle(): Promise<boolean> {
  const url = toxicityReleaseAssetUrl();
  const cache = mlBundleCacheDir();
  const dlDir = join(cache, "..", "downloads");
  mkdirSync(dlDir, { recursive: true });
  const zipPath = join(dlDir, TOXICITY_ONNX_ASSET);
  const tmpExtract = join(dlDir, "_toxicity_extract");

  try {
    process.stderr.write(`[kca] 독성 ML 번들 다운로드 중… ${url}\n`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body) {
      process.stderr.write(`[kca] 독성 번들 다운로드 실패 (${res.status}): ${url}\n`);
      return false;
    }
    await pipeline(
      Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
      createWriteStream(zipPath),
    );
    if (existsSync(tmpExtract)) rmSync(tmpExtract, { recursive: true, force: true });
    mkdirSync(tmpExtract, { recursive: true });
    if (!extractZip(zipPath, tmpExtract)) {
      process.stderr.write("[kca] 독성 번들 압축 해제 실패 (tar/unzip 필요)\n");
      return false;
    }
    const nested = join(tmpExtract, BUNDLED_TOXICITY_MODEL_ID);
    const src = existsSync(join(nested, "config.json"))
      ? nested
      : findModelDir(tmpExtract, BUNDLED_TOXICITY_MODEL_ID);
    if (!src) {
      process.stderr.write("[kca] 독성 번들 zip 구조가 예상과 다릅니다\n");
      return false;
    }
    const dest = join(cache, BUNDLED_TOXICITY_MODEL_ID);
    mkdirSync(cache, { recursive: true });
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    process.stderr.write(`[kca] 독성 ML 번들 설치됨: ${dest}\n`);
    return isToxicityBundleReady();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kca] 독성 번들 다운로드 오류: ${msg}\n`);
    return false;
  } finally {
    if (existsSync(tmpExtract)) rmSync(tmpExtract, { recursive: true, force: true });
  }
}

/** GitHub Release 에서 KURE ONNX zip 다운로드 → cache */
export async function ensureKureBundle(): Promise<boolean> {
  if (isKureBundleReady()) return true;
  if (process.env.KCA_NO_KURE_DOWNLOAD === "1") return false;
  if (!kureDownloadPromise) {
    kureDownloadPromise = downloadKureBundle().finally(() => {
      if (!isKureBundleReady()) kureDownloadPromise = null;
    });
  }
  return kureDownloadPromise;
}

async function downloadKureBundle(): Promise<boolean> {
  const url = kureReleaseAssetUrl();
  const cache = mlBundleCacheDir();
  const dlDir = join(cache, "..", "downloads");
  mkdirSync(dlDir, { recursive: true });
  const zipPath = join(dlDir, KURE_ONNX_ASSET);
  const tmpExtract = join(dlDir, "_kure_extract");

  try {
    process.stderr.write(`[kca] KURE 임베딩 번들 다운로드 중… ${url}\n`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body) {
      process.stderr.write(`[kca] KURE 번들 다운로드 실패 (${res.status}): ${url}\n`);
      return false;
    }
    await pipeline(
      Readable.fromWeb(res.body as import("node:stream/web").ReadableStream),
      createWriteStream(zipPath),
    );
    if (existsSync(tmpExtract)) rmSync(tmpExtract, { recursive: true, force: true });
    mkdirSync(tmpExtract, { recursive: true });
    if (!extractZip(zipPath, tmpExtract)) {
      process.stderr.write("[kca] KURE 번들 압축 해제 실패 (tar/unzip 필요)\n");
      return false;
    }
    const src = resolveKureExtractSrc(tmpExtract);
    if (!src) {
      process.stderr.write("[kca] KURE 번들 zip 구조가 예상과 다릅니다\n");
      return false;
    }
    const dest = join(cache, BUNDLED_KURE_MODEL_ID);
    mkdirSync(cache, { recursive: true });
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    process.stderr.write(`[kca] KURE 임베딩 번들 설치됨: ${dest}\n`);
    return isKureBundleReady();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kca] KURE 번들 다운로드 오류: ${msg}\n`);
    return false;
  } finally {
    if (existsSync(tmpExtract)) rmSync(tmpExtract, { recursive: true, force: true });
  }
}

function resolveKureExtractSrc(tmpExtract: string): string | undefined {
  const nested = join(tmpExtract, BUNDLED_KURE_MODEL_ID);
  if (kureOnnxReady(tmpExtract)) return nested;
  if (
    existsSync(join(tmpExtract, "config.json")) &&
    existsSync(join(tmpExtract, "onnx", "model.onnx")) &&
    existsSync(join(tmpExtract, "onnx", "model.onnx_data"))
  ) {
    return tmpExtract;
  }
  return undefined;
}

function findModelDir(root: string, modelId: string): string | undefined {
  const direct = join(root, modelId);
  if (existsSync(join(direct, "config.json"))) return direct;
  for (const name of readdirSync(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const p = join(root, name.name);
    if (existsSync(join(p, "config.json"))) return p;
  }
  return undefined;
}
