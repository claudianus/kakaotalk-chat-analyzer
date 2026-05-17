import { isPrimarilyKoreanMessages } from "./korean-locale.js";
const MIN_SEMANTIC_MESSAGES = 48;
/** 코퍼스 규모별 임베딩·리저보어 상한 */
export function semanticSampleCap(messageCount) {
    if (messageCount >= 100_000)
        return 2_000;
    if (messageCount >= 50_000)
        return 1_200;
    if (messageCount >= 10_000)
        return 800;
    return 480;
}
/** 스트리밍·사전 집계 없을 때 리저보어 상한 */
export function semanticReservoirCap(estimatedMessages) {
    if (estimatedMessages === undefined || estimatedMessages === 0) {
        return semanticSampleCap(100_000);
    }
    return semanticSampleCap(estimatedMessages);
}
function subsampleHash(message, index) {
    let h = 2166136261 ^ index;
    const slice = message.slice(0, 96);
    for (let i = 0; i < slice.length; i += 1) {
        h ^= slice.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** 리저보어·임베딩 상한 초과 시 결정적 subsample (회귀·재현용) */
export function subsampleSemanticMessages(messages, cap) {
    if (messages.length <= cap)
        return messages;
    return messages
        .map((m, i) => ({ m, h: subsampleHash(m, i) }))
        .sort((a, b) => a.h - b.h || a.m.length - b.m.length)
        .slice(0, cap)
        .map((x) => x.m);
}
/** 한국어 MTEB 경량 1위급 — intfloat/multilingual-e5-small (Xenova ONNX) */
export const DEFAULT_KOREAN_SEMANTIC_MODEL = "Xenova/multilingual-e5-small";
/** 이전 기본값(롤백: `KCA_SEMANTIC_MODEL` 로 지정) */
export const LEGACY_SEMANTIC_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const E5_QUERY_PREFIX = "query: ";
export function semanticEmbeddingModelId() {
    const env = process.env.KCA_SEMANTIC_MODEL?.trim();
    if (env)
        return env;
    return DEFAULT_KOREAN_SEMANTIC_MODEL;
}
/** E5 계열은 대칭 클러스터링에도 MS 권장 `query:` 접두사 사용 */
export function needsE5QueryPrefix(modelId) {
    const id = modelId.toLowerCase();
    if (id.includes("minilm") || id.includes("paraphrase-multilingual"))
        return false;
    return id.includes("e5") || id.includes("koe5");
}
export function formatTextForEmbedding(text, modelId) {
    const id = modelId ?? semanticEmbeddingModelId();
    if (!needsE5QueryPrefix(id))
        return text;
    const trimmed = text.trimStart();
    if (trimmed.startsWith("query:") || trimmed.startsWith("passage:"))
        return text;
    return `${E5_QUERY_PREFIX}${text}`;
}
export function shouldCollectSemanticSamples(messageCount) {
    return messageCount >= MIN_SEMANTIC_MESSAGES && process.env.KCA_NO_SEMANTIC !== "1";
}
/**
 * 시맨틱 키워드 적용 여부.
 * - 기본(auto): 한국어 비중 높은 방 + 48건 이상
 * - `KCA_NO_SEMANTIC=1` / `--no-semantic-keywords` 로 끔
 */
export function resolveSemanticKeywords(options, prepass, sampleMessages) {
    if (process.env.KCA_NO_SEMANTIC === "1")
        return false;
    if (options?.semanticKeywords === false)
        return false;
    if (prepass.messageCount < MIN_SEMANTIC_MESSAGES)
        return false;
    if (options?.semanticKeywords === true)
        return true;
    if (process.env.KCA_SEMANTIC === "1")
        return true;
    if (process.env.KCA_SEMANTIC === "0")
        return false;
    if (process.env.KCA_SEMANTIC_DEFAULT === "opt-in")
        return false;
    return isPrimarilyKoreanMessages(sampleMessages);
}
//# sourceMappingURL=semantic-policy.js.map