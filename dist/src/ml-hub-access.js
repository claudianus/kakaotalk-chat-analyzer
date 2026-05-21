const HUB_TOKEN_KEYS = ["HF_TOKEN", "HF_ACCESS_TOKEN", "HUGGING_FACE_HUB_TOKEN"];
const DEFAULT_HUB_HOSTS = ["https://huggingface.co/", "https://hf-mirror.com/"];
let hubMirrorChain = Promise.resolve();
function withHubMirrorLock(fn) {
    let release;
    const slot = new Promise((resolve) => {
        release = resolve;
    });
    const run = hubMirrorChain.then(() => fn());
    hubMirrorChain = slot;
    return run.finally(() => release());
}
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
 * Hugging Face Hub 미러 순회.
 * 전략 1: HF token이 있으면 token 사용으로 먼저 시도.
 * 전략 2: token 사용 실패 시 → token 삭제 후 public fetch로 재시도.
 * 이중 전략으로 "Unauthorized access" 오류를 회피합니다.
 */
export async function runWithHubMirrors(mod, fn) {
    return withHubMirrorLock(async () => {
        const previousHost = mod.env.remoteHost;
        const hosts = hubMirrorHosts();
        let lastError;
        // 전략 1: HF token이 있으면 token 사용으로 시도
        const hasToken = !!(process.env.HF_TOKEN ?? process.env.HF_ACCESS_TOKEN ?? process.env.HUGGING_FACE_HUB_TOKEN);
        if (hasToken) {
            for (const host of hosts) {
                mod.env.remoteHost = host;
                try {
                    return await fn();
                }
                catch (error) {
                    lastError = error;
                }
            }
        }
        // 전략 2: token 삭제 후 public fetch로 재시도
        const savedTokens = clearHubTokensForPublicFetch();
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
            restoreHubTokens(savedTokens);
        }
    });
}
//# sourceMappingURL=ml-hub-access.js.map