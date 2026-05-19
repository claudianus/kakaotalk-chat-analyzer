import { HUB_BGE_M3, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS, HUB_KOREAN_KURE_V1, SEMANTIC_HEADROOM_KURE_BALANCED_GB, SEMANTIC_HEADROOM_KURE_GB, } from "./ml/model-ids.js";
import { BUNDLED_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID, isBundledEmbedModelReady, isBundledKureModelReady, } from "./ml-bundled-models.js";
/** preset·RAM 기준 Hub 임베딩 id (env·번들 제외) — KoELECTRA 계열만 기본 */
export function resolveDefaultSemanticHubId(preset, headroomGb) {
    if (preset === "quality" || preset === "ultra")
        return HUB_KOELECTRA_EMBED;
    if (preset === "balanced" && headroomGb >= SEMANTIC_HEADROOM_KURE_BALANCED_GB) {
        return HUB_KOELECTRA_EMBED;
    }
    return HUB_KOELECTRA_KORSTS;
}
/** quality·ultra — 로컬 KURE ONNX (Release zip, ~2.1GB) */
export function shouldPreferBundledKure(preset, headroomGb) {
    if (process.env.KCA_PREFER_BUNDLED_SEMANTIC === "0")
        return false;
    if (headroomGb < SEMANTIC_HEADROOM_KURE_GB)
        return false;
    return preset === "quality" || preset === "ultra";
}
/** 번들 시맨틱 id — ultra/quality는 KURE 시도(없으면 로드 폴백), 그 외 embed */
export function resolveBundledSemanticModelId(preset, headroomGb) {
    if (shouldPreferBundledKure(preset, headroomGb)) {
        if (process.env.KCA_NO_KURE_DOWNLOAD === "1" && !isBundledKureModelReady()) {
            return BUNDLED_EMBED_MODEL_ID;
        }
        return BUNDLED_KURE_MODEL_ID;
    }
    return BUNDLED_EMBED_MODEL_ID;
}
/** 오프라인 번들 우선 — `KCA_PREFER_BUNDLED_SEMANTIC=0` 이면 Hub KoELECTRA */
export function shouldPreferBundledSemantic(preset, headroomGb) {
    if (process.env.KCA_PREFER_BUNDLED_SEMANTIC === "0")
        return false;
    if (!isBundledEmbedModelReady())
        return false;
    if (preset === "ultra" || preset === "quality")
        return true;
    if (preset === "balanced")
        return headroomGb < SEMANTIC_HEADROOM_KURE_BALANCED_GB;
    return true;
}
/** 로드 실패 시 순차 폴백 — Hub KURE/BGE는 env 지정 시만, 번들 KURE 실패 시 embed */
export function semanticEmbeddingFallbackIds(primary) {
    const id = primary.toLowerCase();
    if (id === BUNDLED_KURE_MODEL_ID || id.includes("kca-kure")) {
        return [primary, BUNDLED_EMBED_MODEL_ID, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS];
    }
    const tiers = [HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS, BUNDLED_EMBED_MODEL_ID];
    if (id.includes("kure"))
        tiers.unshift(HUB_KOREAN_KURE_V1);
    if (id.includes("bge"))
        tiers.unshift(HUB_BGE_M3);
    const out = [];
    for (const candidate of [primary, ...tiers]) {
        if (!out.includes(candidate))
            out.push(candidate);
    }
    return out;
}
//# sourceMappingURL=semantic-model-resolve.js.map