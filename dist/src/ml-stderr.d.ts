export declare function mlStderrQuietEnabled(): boolean;
/** @xenova/transformers·ONNX의 반복 stderr 억제 */
export declare function withQuietMlStderr<T>(fn: () => Promise<T>): Promise<T>;
