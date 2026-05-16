import { existsSync, mkdirSync, readFileSync, createWriteStream } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { KiwiBuilder, Match } from "kiwi-nlp";
import { canonicalKeywordToken } from "./keyword-canonical.js";
const KIWI_MODEL_TAG = "0.23.1";
const MODEL_URL = `https://github.com/bab2min/Kiwi/releases/download/v${KIWI_MODEL_TAG}/kiwi_model_v${KIWI_MODEL_TAG}_base.tgz`;
const MODEL_FILES = [
    "combiningRule.txt",
    "cong.mdl",
    "default.dict",
    "dialect.dict",
    "extract.mdl",
    "multi.dict",
    "nounchr.mdl",
    "sj.morph",
    "typo.dict",
];
const CACHE_ROOT = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "kiwi-base");
const MODEL_DIR = join(CACHE_ROOT, "models", "cong", "base");
let initPromise = null;
let readyKiwi = null;
let initFailed = false;
function kiwiPackageRoot() {
    return dirname(fileURLToPath(import.meta.resolve("kiwi-nlp/package.json")));
}
function wasmPath() {
    return join(kiwiPackageRoot(), "dist", "kiwi-wasm.wasm");
}
function loadModelBuffers() {
    const files = {};
    for (const name of MODEL_FILES) {
        const p = join(MODEL_DIR, name);
        files[name] = readFileSync(p);
    }
    return files;
}
function modelInstalled() {
    if (!existsSync(MODEL_DIR))
        return false;
    return MODEL_FILES.every((f) => existsSync(join(MODEL_DIR, f)));
}
async function downloadModelArchive(destTgz) {
    mkdirSync(dirname(destTgz), { recursive: true });
    const res = await fetch(MODEL_URL);
    if (!res.ok || !res.body) {
        throw new Error(`Kiwi model download failed (${res.status}): ${MODEL_URL}`);
    }
    await pipeline(res.body, createWriteStream(destTgz));
}
function extractModelArchive(tgzPath) {
    mkdirSync(CACHE_ROOT, { recursive: true });
    const tar = spawnSync("tar", ["-xzf", tgzPath, "-C", CACHE_ROOT], { encoding: "utf8" });
    if (tar.status !== 0) {
        throw new Error(tar.stderr || `tar exited ${tar.status}`);
    }
    if (!modelInstalled()) {
        throw new Error("Kiwi model extract finished but base files are missing");
    }
}
async function ensureModelOnDisk() {
    if (modelInstalled())
        return;
    const tgzPath = join(CACHE_ROOT, `kiwi_model_${KIWI_MODEL_TAG}_base.tgz`);
    if (!existsSync(tgzPath)) {
        process.stderr.write("[kca] Kiwi 한국어 모델 다운로드 중… (최초 1회, 무료)\n");
        await downloadModelArchive(tgzPath);
    }
    if (!modelInstalled()) {
        process.stderr.write("[kca] Kiwi 모델 압축 해제 중…\n");
        extractModelArchive(tgzPath);
    }
}
async function buildKiwi() {
    const builder = await KiwiBuilder.create(wasmPath());
    return builder.build({
        modelFiles: loadModelBuffers(),
        modelType: "cong",
        integrateAllomorph: true,
        loadDefaultDict: true,
        loadTypoDict: true,
        loadMultiDict: true,
    });
}
/** 형태소 분석기 준비(실패 시 null → 휴리스틱 폴백) */
export async function initKiwiRuntime() {
    if (process.env.KCA_NO_KIWI === "1") {
        initFailed = true;
        return null;
    }
    if (readyKiwi)
        return readyKiwi;
    if (initFailed)
        return null;
    if (!initPromise) {
        initPromise = (async () => {
            try {
                await ensureModelOnDisk();
                readyKiwi = await buildKiwi();
                return readyKiwi;
            }
            catch (err) {
                initFailed = true;
                const msg = err instanceof Error ? err.message : String(err);
                process.stderr.write(`[kca] Kiwi 초기화 실패, 휴리스틱 토큰화로 계속합니다: ${msg}\n`);
                return null;
            }
        })();
    }
    return initPromise;
}
export function getKiwiRuntime() {
    return readyKiwi;
}
export function isKiwiReady() {
    return readyKiwi !== null;
}
/** Kiwi가 켜져 있을 때만 호출 */
const KIWI_MAX_CHARS = 768;
export function kiwiKeywordTokens(text) {
    const kiwi = readyKiwi;
    if (!kiwi)
        return [];
    const slice = text.length > KIWI_MAX_CHARS ? text.slice(0, KIWI_MAX_CHARS) : text;
    const tokens = kiwi.tokenize(slice, Match.joinNounSuffix |
        Match.url |
        Match.hashtag |
        Match.mention |
        Match.serial |
        Match.normalizeCoda, undefined, undefined, "basic");
    const out = [];
    const seen = new Set();
    for (const t of tokens) {
        if (!isKeywordPos(t.tag))
            continue;
        const form = normalizeKiwiForm(t.str);
        if (!form || seen.has(form))
            continue;
        seen.add(form);
        out.push(form);
    }
    return out;
}
function isKeywordPos(tag) {
    if (tag === "SL" || tag === "SN")
        return true;
    if (tag.startsWith("NN"))
        return true;
    if (tag === "NR")
        return true;
    if (tag === "W_URL" || tag === "W_EMAIL")
        return true;
    if (tag === "W_HASHTAG")
        return true;
    return false;
}
function normalizeKiwiForm(raw) {
    let w = raw.trim();
    if (w.startsWith("#"))
        w = w.slice(1);
    if (w.length < 2)
        return "";
    if (/^[A-Za-z0-9_+-]+$/.test(w))
        return canonicalKeywordToken(w.toLowerCase());
    return canonicalKeywordToken(w);
}
/** 캐시 디렉터리(테스트·진단용) */
export function kiwiCacheDir() {
    return CACHE_ROOT;
}
export function resetKiwiRuntimeForTests() {
    readyKiwi = null;
    initPromise = null;
    initFailed = false;
}
//# sourceMappingURL=kiwi-runtime.js.map