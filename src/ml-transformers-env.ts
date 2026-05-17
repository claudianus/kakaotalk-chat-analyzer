import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ensureMlStderrQuantizationFilter } from "./ml-stderr.js";

type TransformersModule = typeof import("@xenova/transformers");

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
  const token = huggingFaceAccessToken();
  if (token && !process.env.HF_TOKEN) process.env.HF_TOKEN = token;
  warnCwdTokenizerShadow();
}

export function isTransformersFetchError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /Unauthorized access|Could not locate file|fetch failed|ENOTFOUND|ETIMEDOUT|403|401/i.test(msg);
}
