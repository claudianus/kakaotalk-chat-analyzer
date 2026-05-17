import { probeMachineProfileSync } from "./analysis-capability.js";
import { probeOnnxGpu } from "./ml-runtime.js";
function envInt(name) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}
/** 임베딩·감정 ONNX 배치 — RAM·GPU·env override */
export function resolveEmbedBatchSize() {
    const forced = envInt("KCA_EMBED_BATCH");
    if (forced)
        return Math.min(128, forced);
    const profile = probeMachineProfileSync();
    let batch = profile.freeMemGb >= 20 ? 32 : profile.freeMemGb >= 12 ? 24 : profile.freeMemGb >= 8 ? 16 : 12;
    const gpu = process.env.KCA_ONNX_GPU?.trim().toLowerCase();
    if (gpu && gpu !== "none" && gpu !== "cpu")
        batch = Math.min(64, batch * 2);
    return batch;
}
export function resolveSentimentBatchSize() {
    const forced = envInt("KCA_SENTIMENT_BATCH");
    if (forced)
        return Math.min(128, forced);
    const profile = probeMachineProfileSync();
    let batch = profile.freeMemGb >= 20 ? 32 : profile.freeMemGb >= 12 ? 24 : 16;
    const gpu = process.env.KCA_ONNX_GPU?.trim().toLowerCase();
    if (gpu && gpu !== "none" && gpu !== "cpu")
        batch = Math.min(64, batch * 2);
    return batch;
}
/** 프로파일·GPU 반영 배치 (비동기 GPU 프로브) */
export async function resolveEmbedBatchSizeAsync() {
    const forced = envInt("KCA_EMBED_BATCH");
    if (forced)
        return Math.min(128, forced);
    const profile = probeMachineProfileSync();
    const gpu = await probeOnnxGpu();
    let batch = profile.freeMemGb >= 20 ? 32 : profile.freeMemGb >= 12 ? 24 : profile.freeMemGb >= 8 ? 16 : 12;
    if (gpu !== "none")
        batch = Math.min(64, batch * 2);
    return batch;
}
//# sourceMappingURL=ml-batch-size.js.map