import { HUB_BGE_M3, HUB_GRANITE_EMBED_97M, HUB_GRANITE_EMBED_311M, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS, HUB_KOREAN_KURE_V1, SEMANTIC_HEADROOM_BGE_GB, SEMANTIC_HEADROOM_KURE_BALANCED_GB, SEMANTIC_HEADROOM_KURE_GB, } from "./ml/model-ids.js";
import { BUNDLED_EMBED_MODEL_ID, BUNDLED_GRANITE_EMBED_MODEL_ID, BUNDLED_KURE_MODEL_ID, isBundledEmbedModelReady, isBundledGraniteEmbedModelReady, isBundledKureModelReady, } from "./ml-bundled-models.js";
/** preset·RAM 기준 Hub 임베딩 id — IBM Granite R2 우선, 레거시 폰백 */
export function resolveDefaultSemanticHubId(preset, headroomGb) {
    if (preset === "ultra" && headroomGb >= SEMANTIC_HEADROOM_BGE_GB) {
        return HUB_GRANITE_EMBED_311M;
    }
    if (preset === "quality" || preset === "ultra")
        return HUB_GRANITE_EMBED_97M;
    if (preset === "balanced" && headroomGb >= SEMANTIC_HEADROOM_KURE_BALANCED_GB) {
        return HUB_GRANITE_EMBED_97M;
    }
    return HUB_KOELECTRA_KORSTS;
}
/** quality·ultra — 로컬 KURE ONNX (Release zip, ~2.1GB) — 레거시, 점진 폐기 */
export function shouldPreferBundledKure(preset, headroomGb) {
    if (process.env.KCA_LEGACY_MODELS === "1") {
        if (process.env.KCA_PREFER_BUNDLED_SEMANTIC === "0")
            return false;
        if (headroomGb < SEMANTIC_HEADROOM_KURE_GB)
            return false;
        return preset === "quality" || preset === "ultra";
    }
    return false;
}
/** 번들 시맨틱 id — Granite 우선, 레거시 KURE/embed 폰백 */
export function resolveBundledSemanticModelId(preset, headroomGb) {
    // Granite 번들 우선 (quality/ultra)
    if (isBundledGraniteEmbedModelReady() && (preset === "quality" || preset === "ultra")) {
        return BUNDLED_GRANITE_EMBED_MODEL_ID;
    }
    if (shouldPreferBundledKure(preset, headroomGb)) {
        if (process.env.KCA_NO_KURE_DOWNLOAD === "1" && !isBundledKureModelReady()) {
            return BUNDLED_EMBED_MODEL_ID;
        }
        return BUNDLED_KURE_MODEL_ID;
    }
    return BUNDLED_EMBED_MODEL_ID;
}
/** 번들 ONNX가 있을 때 preset·RAM 기준 시맨틱 번들 사용 여부 (순수 정책) */
export function shouldPreferBundledSemanticPolicy(preset, headroomGb) {
    if (process.env.KCA_PREFER_BUNDLED_SEMANTIC === "0")
        return false;
    if (preset === "ultra" || preset === "quality")
        return true;
    if (preset === "balanced")
        return headroomGb < SEMANTIC_HEADROOM_KURE_BALANCED_GB;
    return true;
}
/** 오프라인 번들 우선 — `KCA_PREFER_BUNDLED_SEMANTIC=0` 이면 Hub */
export function shouldPreferBundledSemantic(preset, headroomGb) {
    if (isBundledGraniteEmbedModelReady())
        return true;
    if (!isBundledEmbedModelReady())
        return false;
    return shouldPreferBundledSemanticPolicy(preset, headroomGb);
}
/** 로드 실패 시 순차 폰백 — Granite → KoELECTRA → 번들 */
export function semanticEmbeddingFallbackIds(primary) {
    const id = primary.toLowerCase();
    const out = [primary];
    // Granite 계열 (311M 번들 미지원 → 97M 번들/Hub 폰백)
    if (id.includes("granite-311m")) {
        out.push(BUNDLED_GRANITE_EMBED_MODEL_ID, HUB_GRANITE_EMBED_97M, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS);
    }
    else if (id.includes("granite-97m")) {
        out.push(BUNDLED_GRANITE_EMBED_MODEL_ID, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS);
    }
    // 레거시 KURE 번들
    else if (id === BUNDLED_KURE_MODEL_ID || id.includes("kca-kure")) {
        out.push(BUNDLED_EMBED_MODEL_ID, HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS);
    }
    // 기본 KoELECTRA 계열
    else {
        const tiers = [HUB_KOELECTRA_EMBED, HUB_KOELECTRA_KORSTS, BUNDLED_EMBED_MODEL_ID];
        if (id.includes("kure"))
            tiers.unshift(HUB_KOREAN_KURE_V1);
        if (id.includes("bge"))
            tiers.unshift(HUB_BGE_M3);
        for (const candidate of tiers) {
            if (!out.includes(candidate))
                out.push(candidate);
        }
    }
    return out;
}
//# sourceMappingURL=semantic-model-resolve.js.map