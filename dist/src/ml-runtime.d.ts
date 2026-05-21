import type { GpuKind } from "./analysis-capability.js";
/** optional onnxruntime-node — 미설치 시 none */
export declare function probeOnnxGpu(): Promise<GpuKind>;
export declare function transformersDeviceHint(gpu: GpuKind): "wasm" | "webgpu";
type TransformersModule = typeof import("@huggingface/transformers");
/** v4 dtype: fp32 | fp16 | q8 | q4 */
export type TransformersDtype = "fp32" | "fp16" | "q8" | "q4";
/** @huggingface/transformers env — ONNX 백엔드·디바이스 힌트 */
export declare function configureTransformersEnv(mod: TransformersModule): Promise<GpuKind>;
/** v4: quantized → dtype. CPU(q8) / GPU(fp32) */
export declare function preferQuantizedModels(gpu: GpuKind): TransformersDtype;
export {};
