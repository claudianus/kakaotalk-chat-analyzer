import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isCoreBundleReady, readModelsPackageVersion } from "./ml-bundle-cache.js";

let coreInstallPromise: Promise<boolean> | null = null;

function kcaPackageRoot(): string {
  try {
    const req = createRequire(import.meta.url);
    return dirname(req.resolve("kakaotalk-chat-analyzer/package.json"));
  } catch {
    try {
      return dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
    } catch {
      return process.cwd();
    }
  }
}

function pinnedModelsVersion(): string {
  try {
    const root = kcaPackageRoot();
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const dep =
      pkg.dependencies?.["kakaotalk-chat-analyzer-models"] ??
      pkg.optionalDependencies?.["kakaotalk-chat-analyzer-models"];
    if (typeof dep === "string" && dep.length > 0 && !dep.startsWith("file:")) return dep;
  } catch {
    /* ignore */
  }
  return readModelsPackageVersion();
}

function runNpmInstallModels(): boolean {
  const ver = pinnedModelsVersion();
  const cwd = kcaPackageRoot();
  process.stderr.write(`[kca] ML 번들 npm 설치 시도: kakaotalk-chat-analyzer-models@${ver}\n`);
  const run = spawnSync(
    "npm",
    ["install", `kakaotalk-chat-analyzer-models@${ver}`, "--no-save", "--no-audit", "--no-fund"],
    { cwd, stdio: "inherit", env: process.env },
  );
  return run.status === 0;
}

/** 감정·임베딩 ONNX — npm models 패키지 자동 설치 */
export async function ensureCoreMlBundles(): Promise<boolean> {
  if (isCoreBundleReady()) return true;
  if (process.env.KCA_NO_ML_AUTO_INSTALL === "1") return false;
  if (!coreInstallPromise) {
    coreInstallPromise = (async () => {
      runNpmInstallModels();
      return isCoreBundleReady();
    })();
  }
  return coreInstallPromise;
}
