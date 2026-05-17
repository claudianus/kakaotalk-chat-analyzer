import type { GpuKind } from "./analysis-capability.js";
/** optional onnxruntime-node — 미설치 시 none */
export declare function probeOnnxGpu(): Promise<GpuKind>;
export declare function transformersDeviceHint(gpu: GpuKind): "wasm" | "webgpu";
type TransformersModule = typeof import("@xenova/transformers");
/** @xenova/transformers env — ONNX 백엔드·디바이스 힌트 */
export declare function configureTransformersEnv(mod: TransformersModule): Promise<GpuKind>;
/** Metal 등에서 quantized 로드 시 ORT 경고 방지 */
export declare function preferQuantizedModels(gpu: GpuKind): boolean;
export {};
