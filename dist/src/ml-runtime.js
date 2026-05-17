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
/** @xenova/transformers env — ONNX 백엔드·디바이스 힌트 */
export async function configureTransformersEnv(mod) {
    const gpu = await probeOnnxGpu();
    const { env } = mod;
    const device = transformersDeviceHint(gpu);
    env.backends = env.backends ?? {};
    if (device === "webgpu") {
        env.backends.onnx = env.backends.onnx ?? {};
        env.backends.onnx.wasm = env.backends.onnx.wasm ?? {};
        env.backends.onnx.wasm.proxy = false;
    }
    if (process.env.KCA_TRANSFORMERS_DEVICE?.trim()) {
        env.backends.onnx = env.backends.onnx ?? {};
        env.backends.onnx.wasm = env.backends.onnx.wasm ?? {};
    }
    return gpu;
}
//# sourceMappingURL=ml-runtime.js.map