import type { GpuKind } from "./analysis-capability.js";

const ORT_MODULE = "onnxruntime-node";

let cachedGpu: GpuKind | null = null;

/** optional onnxruntime-node — 미설치 시 none */
export async function probeOnnxGpu(): Promise<GpuKind> {
  if (cachedGpu) return cachedGpu;
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
    if (process.platform === "win32") cachedGpu = "dml";
    else if (process.platform === "linux") cachedGpu = "cuda";
    else if (process.platform === "darwin") cachedGpu = "metal";
    else cachedGpu = "none";
  } catch {
    cachedGpu = "none";
  }
  return cachedGpu;
}

export function transformersDeviceHint(gpu: GpuKind): "wasm" | "webgpu" {
  return gpu === "webgpu" ? "webgpu" : "wasm";
}

type TransformersModule = typeof import("@xenova/transformers");

/** @xenova/transformers env — ONNX 백엔드·디바이스 힌트 */
export async function configureTransformersEnv(mod: TransformersModule): Promise<GpuKind> {
  const gpu = await probeOnnxGpu();
  const { env } = mod;
  const device = transformersDeviceHint(gpu);
  env.backends = env.backends ?? {};
  if (device === "webgpu") {
    env.backends.onnx = env.backends.onnx ?? {};
    env.backends.onnx.wasm = env.backends.onnx.wasm ?? {};
    env.backends.onnx.wasm.proxy = false;
  }
  const forcedDevice = process.env.KCA_TRANSFORMERS_DEVICE?.trim().toLowerCase();
  if (forcedDevice === "webgpu") {
    env.backends.onnx = env.backends.onnx ?? {};
    env.backends.onnx.wasm = env.backends.onnx.wasm ?? {};
    env.backends.onnx.wasm.proxy = false;
  }
  return gpu;
}
