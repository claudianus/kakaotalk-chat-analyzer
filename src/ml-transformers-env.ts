import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { clearHubTokensForPublicFetch } from "./ml-hub-access.js";
import { bundledMlModelsRoot } from "./ml-bundled-models.js";
import { ensureMlStderrQuantizationFilter } from "./ml-stderr.js";

type TransformersModule = typeof import("@huggingface/transformers");

const DEFAULT_CACHE = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "transformers");

export function huggingFaceAccessToken(): string | undefined {
  const token = process.env.HF_TOKEN ?? process.env.HUGGING_FACE_HUB_TOKEN;
  const trimmed = token?.trim();
  return trimmed ? trimmed : undefined;
}

/** cwd의 tokenizer.json이 hub 모델 로드를 깨는 경우 경고 */
export function warnCwdTokenizerShadow(): void {
  const shadow = resolve(process.cwd(), "tokenizer.json");
  if (!existsSync(shadow)) return;
  process.stderr.write(
    `[kca] 경고: ${shadow} 파일이 있으면 Hugging Face 모델 다운로드가 실패할 수 있습니다. 다른 위치로 옮기거나 이름을 바꿔 주세요.\n`,
  );
}

export function applyTransformersEnv(mod: TransformersModule, cacheDir = DEFAULT_CACHE): void {
  ensureMlStderrQuantizationFilter();
  const { env } = mod;
  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  const bundledRoot = bundledMlModelsRoot();
  if (bundledRoot) env.localModelPath = bundledRoot;
  const token = huggingFaceAccessToken();
  const hasToken = !!token;
  // HF token이 있으면 자동 사용. 명시적 KCA_USE_HF_TOKEN=0 만 token 삭제
  if (process.env.KCA_USE_HF_TOKEN === "0" || (!hasToken && process.env.KCA_USE_HF_TOKEN !== "1")) {
    clearHubTokensForPublicFetch();
  } else if (hasToken) {
    if (!process.env.HF_TOKEN) process.env.HF_TOKEN = token;
  }
  warnCwdTokenizerShadow();
}

/**
 * 로컬 번들 로드 시 HF Hub 폰백을 차단합니다.
 * 로컬에 파일이 있으면 로컬에서만 로드되고, 없으면 오류를 발생시킵니다.
 */
export function withLocalModelsOnly<T>(mod: TransformersModule, fn: () => Promise<T>): Promise<T> {
  const { env } = mod;
  const previous = env.allowRemoteModels;
  env.allowRemoteModels = false;
  return fn().finally(() => {
    env.allowRemoteModels = previous;
  });
}

export function isTransformersFetchError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Unauthorized access|Could not locate file|fetch failed|ENOTFOUND|ETIMEDOUT|403|401/i.test(msg);
}
