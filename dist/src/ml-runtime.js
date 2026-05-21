import { applyTransformersEnv } from "./ml-transformers-env.js";
const ORT_MODULE = "onnxruntime-node";
let cachedGpu = null;
/** optional onnxruntime-node — 미설치 시 none */
export async function probeOnnxGpu() {
    if (cachedGpu)
        return cachedGpu;
    const env = process.env.KCA_ONNX_GPU?.trim().toLowerCase();
    if (env === "cuda" || env === "dml" || env === "metal" || env === "webgpu") {
        cachedGpu = env;
        return env;
    }
    if (env === "none" || env === "cpu") {
        cachedGpu = "none";
        return "none";
    }
    try {
        await import(ORT_MODULE);
        if (process.platform === "win32")
            cachedGpu = "dml";
        else if (process.platform === "linux")
            cachedGpu = "cuda";
        else if (process.platform === "darwin")
            cachedGpu = "metal";
        else
            cachedGpu = "none";
    }
    catch {
        cachedGpu = "none";
    }
    return cachedGpu;
}
export function transformersDeviceHint(gpu) {
    return gpu === "webgpu" ? "webgpu" : "wasm";
}
/** @huggingface/transformers env — ONNX 백엔드·디바이스 힌트 */
export async function configureTransformersEnv(mod) {
    const gpu = await probeOnnxGpu();
    applyTransformersEnv(mod);
    return gpu;
}
/** v4: quantized → dtype. CPU(q8) / GPU(fp32) */
export function preferQuantizedModels(gpu) {
    if (process.env.KCA_ML_QUANTIZED === "0")
        return "fp32";
    if (process.env.KCA_ML_QUANTIZED === "1")
        return "q8";
    return gpu === "none" ? "q8" : "fp32";
}
//# sourceMappingURL=ml-runtime.js.map