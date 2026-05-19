import { createWriteStream, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BUNDLED_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID, BUNDLED_SENTIMENT_MODEL_ID, BUNDLED_TOXICITY_MODEL_ID, } from "./ml-bundle-ids.js";
export const TOXICITY_ONNX_ASSET = "kca-kcelectra-base-toxicity-onnx.zip";
export const KURE_ONNX_ASSET = "kca-kure-v1-onnx.zip";
const DEFAULT_REPO = "claudianus/kakaotalk-chat-analyzer";
export function mlBundleCacheDir() {
    const env = process.env.KCA_ML_CACHE?.trim();
    if (env)
        return join(env, "ml-models");
    return join(homedir(), ".cache", "kakaotalk-chat-analyzer", "ml-models");
}
export function readModelsPackageVersion() {
    try {
        const req = createRequire(import.meta.url);
        const pkg = req.resolve("kakaotalk-chat-analyzer-models/package.json");
        return JSON.parse(readFileSync(pkg, "utf8")).version;
    }
    catch {
        return process.env.KCA_ML_MODELS_VERSION?.trim() || "0.2.0";
    }
}
export function mlModelsReleaseTag() {
    const env = process.env.KCA_ML_MODELS_RELEASE?.trim();
    if (env)
        return env;
    return `ml-models-v${readModelsPackageVersion()}`;
}
/** @deprecated */ export const toxicityReleaseTag = mlModelsReleaseTag;
function pinnedReleaseAssetUrl(assetName) {
    const repo = process.env.KCA_ML_MODELS_REPO?.trim() || DEFAULT_REPO;
    return `https://github.com/${repo}/releases/download/${mlModelsReleaseTag()}/${assetName}`;
}
export function toxicityReleaseAssetUrl() {
    return pinnedReleaseAssetUrl(TOXICITY_ONNX_ASSET);
}
export function kureReleaseAssetUrl() {
    return pinnedReleaseAssetUrl(KURE_ONNX_ASSET);
}
/** pinned tag → GitHub Releases API(최신 ml-models-v* asset) 순 */
export async function listReleaseAssetUrls(assetName) {
    const urls = [pinnedReleaseAssetUrl(assetName)];
    const repo = process.env.KCA_ML_MODELS_REPO?.trim() || DEFAULT_REPO;
    const slash = repo.indexOf("/");
    if (slash <= 0)
        return urls;
    const owner = repo.slice(0, slash);
    const name = repo.slice(slash + 1);
    try {
        for (let page = 1; page <= 5; page += 1) {
            const api = `https://api.github.com/repos/${owner}/${name}/releases?per_page=100&page=${page}`;
            const res = await fetch(api, {
                redirect: "follow",
                headers: {
                    Accept: "application/vnd.github+json",
                    "User-Agent": "kakaotalk-chat-analyzer",
                },
            });
            if (!res.ok)
                break;
            const releases = (await res.json());
            if (releases.length === 0)
                break;
            for (const rel of releases) {
                const tag = rel.tag_name?.trim();
                if (!tag?.startsWith("ml-models-v"))
                    continue;
                const asset = rel.assets?.find((a) => a.name === assetName);
                const href = asset?.browser_download_url?.trim();
                if (href)
                    urls.push(href);
            }
            if (releases.length < 100)
                break;
        }
    }
    catch {
        /* API 실패 시 pinned URL만 */
    }
    return [...new Set(urls)];
}
function modelOnnxReady(root, modelId) {
    return (existsSync(join(root, modelId, "config.json")) &&
        existsSync(join(root, modelId, "onnx", "model.onnx")));
}
function kureOnnxReady(root) {
    return (modelOnnxReady(root, BUNDLED_KURE_MODEL_ID) &&
        existsSync(join(root, BUNDLED_KURE_MODEL_ID, "onnx", "model.onnx_data")));
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
export function isKureBundleReady() {
    return listMlModelRoots().some((r) => kureOnnxReady(r));
}
export function isCoreBundleReady() {
    return isSentimentBundleReady() && isEmbedBundleReady();
}
/** npm models 패키지 → monorepo data → user cache */
export function listMlModelRoots() {
    const roots = [];
    try {
        const req = createRequire(import.meta.url);
        const pkg = req.resolve("kakaotalk-chat-analyzer-models/package.json");
        const dir = join(dirname(pkg), "data", "ml-models");
        if (existsSync(dir))
            roots.push(dir);
    }
    catch {
        /* not installed */
    }
    const pkgData = join(fileURLToPath(new URL("..", import.meta.url)), "..", "data", "ml-models");
    if (existsSync(pkgData))
        roots.push(pkgData);
    const cache = mlBundleCacheDir();
    if (existsSync(cache))
        roots.push(cache);
    return [...new Set(roots)];
}
export function resolveMlModelRootFor(modelId) {
    for (const root of listMlModelRoots()) {
        if (modelOnnxReady(root, modelId))
            return root;
    }
    return undefined;
}
function extractZip(zipPath, destDir) {
    mkdirSync(destDir, { recursive: true });
    const tar = spawnSync("tar", ["-xf", zipPath, "-C", destDir], { encoding: "utf8" });
    if (tar.status === 0)
        return true;
    const unzip = spawnSync("unzip", ["-q", "-o", zipPath, "-d", destDir], { encoding: "utf8" });
    return unzip.status === 0;
}
let toxicityDownloadPromise = null;
let kureDownloadPromise = null;
/** GitHub Release 에서 독성 ONNX zip 다운로드 → cache */
export async function ensureToxicityBundle() {
    if (isToxicityBundleReady())
        return true;
    if (process.env.KCA_NO_TOXICITY_DOWNLOAD === "1")
        return false;
    if (!toxicityDownloadPromise) {
        toxicityDownloadPromise = downloadToxicityBundle().finally(() => {
            if (!isToxicityBundleReady())
                toxicityDownloadPromise = null;
        });
    }
    return toxicityDownloadPromise;
}
async function downloadToxicityBundle() {
    return installLazyOnnxZip({
        label: "독성 ML",
        assetName: TOXICITY_ONNX_ASSET,
        extractDirName: "_toxicity_extract",
        resolveSrc: (tmpExtract) => {
            const nested = join(tmpExtract, BUNDLED_TOXICITY_MODEL_ID);
            if (existsSync(join(nested, "config.json")))
                return nested;
            return findModelDir(tmpExtract, BUNDLED_TOXICITY_MODEL_ID);
        },
        destModelId: BUNDLED_TOXICITY_MODEL_ID,
        isReady: isToxicityBundleReady,
    });
}
/** GitHub Release 에서 KURE ONNX zip 다운로드 → cache */
export async function ensureKureBundle() {
    if (isKureBundleReady())
        return true;
    if (process.env.KCA_NO_KURE_DOWNLOAD === "1")
        return false;
    if (!kureDownloadPromise) {
        kureDownloadPromise = downloadKureBundle().finally(() => {
            if (!isKureBundleReady())
                kureDownloadPromise = null;
        });
    }
    return kureDownloadPromise;
}
async function downloadKureBundle() {
    return installLazyOnnxZip({
        label: "KURE 임베딩",
        assetName: KURE_ONNX_ASSET,
        extractDirName: "_kure_extract",
        resolveSrc: resolveKureExtractSrc,
        destModelId: BUNDLED_KURE_MODEL_ID,
        isReady: isKureBundleReady,
    });
}
async function installLazyOnnxZip(opts) {
    const urls = await listReleaseAssetUrls(opts.assetName);
    const cache = mlBundleCacheDir();
    const dlDir = join(cache, "..", "downloads");
    mkdirSync(dlDir, { recursive: true });
    const zipPath = join(dlDir, opts.assetName);
    const tmpExtract = join(dlDir, opts.extractDirName);
    try {
        let fetched = false;
        for (const url of urls) {
            process.stderr.write(`[kca] ${opts.label} 번들 다운로드 중… ${url}\n`);
            const res = await fetch(url, { redirect: "follow" });
            if (!res.ok || !res.body) {
                process.stderr.write(`[kca] ${opts.label} 다운로드 실패 (${res.status})\n`);
                continue;
            }
            await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath));
            fetched = true;
            break;
        }
        if (!fetched) {
            process.stderr.write(`[kca] ${opts.label} Release zip(${opts.assetName})을 찾지 못했습니다. ` +
                `잠시 후 재시도하거나 CI publish-ml-models 완료를 확인하세요.\n`);
            return false;
        }
        if (existsSync(tmpExtract))
            rmSync(tmpExtract, { recursive: true, force: true });
        mkdirSync(tmpExtract, { recursive: true });
        if (!extractZip(zipPath, tmpExtract)) {
            process.stderr.write(`[kca] ${opts.label} 압축 해제 실패 (tar/unzip 필요)\n`);
            return false;
        }
        const src = opts.resolveSrc(tmpExtract);
        if (!src) {
            process.stderr.write(`[kca] ${opts.label} zip 구조가 예상과 다릅니다\n`);
            return false;
        }
        const dest = join(cache, opts.destModelId);
        mkdirSync(cache, { recursive: true });
        if (existsSync(dest))
            rmSync(dest, { recursive: true, force: true });
        cpSync(src, dest, { recursive: true });
        process.stderr.write(`[kca] ${opts.label} 번들 설치됨: ${dest}\n`);
        return opts.isReady();
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[kca] ${opts.label} 다운로드 오류: ${msg}\n`);
        return false;
    }
    finally {
        if (existsSync(tmpExtract))
            rmSync(tmpExtract, { recursive: true, force: true });
    }
}
function resolveKureExtractSrc(tmpExtract) {
    const nested = join(tmpExtract, BUNDLED_KURE_MODEL_ID);
    if (kureOnnxReady(tmpExtract))
        return nested;
    if (existsSync(join(tmpExtract, "config.json")) &&
        existsSync(join(tmpExtract, "onnx", "model.onnx")) &&
        existsSync(join(tmpExtract, "onnx", "model.onnx_data"))) {
        return tmpExtract;
    }
    return undefined;
}
function findModelDir(root, modelId) {
    const direct = join(root, modelId);
    if (existsSync(join(direct, "config.json")))
        return direct;
    for (const name of readdirSync(root, { withFileTypes: true })) {
        if (!name.isDirectory())
            continue;
        const p = join(root, name.name);
        if (existsSync(join(p, "config.json")))
            return p;
    }
    return undefined;
}
//# sourceMappingURL=ml-bundle-cache.js.map