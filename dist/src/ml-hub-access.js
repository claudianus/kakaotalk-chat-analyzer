const HUB_TOKEN_KEYS = ["HF_TOKEN", "HF_ACCESS_TOKEN", "HUGGING_FACE_HUB_TOKEN"];
const DEFAULT_HUB_HOSTS = ["https://huggingface.co/", "https://hf-mirror.com/"];
/** 공개 Xenova 모델 — 만료·잘못된 HF 토큰이 401을 유발할 수 있어 기본은 헤더 미전송 */
export function clearHubTokensForPublicFetch() {
    const saved = new Map();
    for (const key of HUB_TOKEN_KEYS) {
        saved.set(key, process.env[key]);
        delete process.env[key];
    }
    return saved;
}
export function restoreHubTokens(saved) {
    for (const [key, value] of saved) {
        if (value === undefined)
            delete process.env[key];
        else
            process.env[key] = value;
    }
}
export function hubMirrorHosts() {
    const custom = process.env.KCA_HF_MIRROR?.trim();
    if (custom)
        return [custom.endsWith("/") ? custom : `${custom}/`];
    return DEFAULT_HUB_HOSTS;
}
/**
 * Hugging Face Hub 미러 순회 + 공개 모델용 토큰 제거.
 * `KCA_USE_HF_TOKEN=1` 이면 환경 토큰을 그대로 둡니다(게이트 모델·비공개 캐시용).
 */
export async function runWithHubMirrors(mod, fn) {
    const useToken = process.env.KCA_USE_HF_TOKEN === "1";
    const savedTokens = useToken ? null : clearHubTokensForPublicFetch();
    const previousHost = mod.env.remoteHost;
    const hosts = hubMirrorHosts();
    let lastError;
    try {
        for (const host of hosts) {
            mod.env.remoteHost = host;
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    finally {
        mod.env.remoteHost = previousHost;
        if (savedTokens)
            restoreHubTokens(savedTokens);
    }
}
//# sourceMappingURL=ml-hub-access.js.map