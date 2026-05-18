import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { clearHubTokensForPublicFetch } from "./ml-hub-access.js";
import { bundledMlModelsRoot } from "./ml-bundled-models.js";
import { ensureMlStderrQuantizationFilter } from "./ml-stderr.js";
const DEFAULT_CACHE = join(homedir(), ".cache", "kakaotalk-chat-analyzer", "transformers");
export function huggingFaceAccessToken() {
    const token = process.env.HF_TOKEN ?? process.env.HUGGING_FACE_HUB_TOKEN;
    const trimmed = token?.trim();
    return trimmed ? trimmed : undefined;
}
/** cwd의 tokenizer.json이 hub 모델 로드를 깨는 경우 경고 */
export function warnCwdTokenizerShadow() {
    const shadow = resolve(process.cwd(), "tokenizer.json");
    if (!existsSync(shadow))
        return;
    process.stderr.write(`[kca] 경고: ${shadow} 파일이 있으면 Hugging Face 모델 다운로드가 실패할 수 있습니다. 다른 위치로 옮기거나 이름을 바꿔 주세요.\n`);
}
export function applyTransformersEnv(mod, cacheDir = DEFAULT_CACHE) {
    ensureMlStderrQuantizationFilter();
    const { env } = mod;
    env.cacheDir = cacheDir;
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    const bundledRoot = bundledMlModelsRoot();
    if (bundledRoot)
        env.localModelPath = bundledRoot;
    if (process.env.KCA_USE_HF_TOKEN !== "1") {
        clearHubTokensForPublicFetch();
    }
    else {
        const token = huggingFaceAccessToken();
        if (token && !process.env.HF_TOKEN)
            process.env.HF_TOKEN = token;
    }
    warnCwdTokenizerShadow();
}
export function isTransformersFetchError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    return /Unauthorized access|Could not locate file|fetch failed|ENOTFOUND|ETIMEDOUT|403|401/i.test(msg);
}
//# sourceMappingURL=ml-transformers-env.js.map