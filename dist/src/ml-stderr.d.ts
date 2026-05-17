/** ONNX Metal 등에서 나오는 quantization 폴백 메시지는 기본 억제 */
export declare function ensureMlStderrQuantizationFilter(): void;
export declare function mlStderrQuietEnabled(): boolean;
/** 추가 ML stderr 전체 억제(KCA_QUIET_ML=1 시 pipeline 로드 구간) */
export declare function withQuietMlStderr<T>(fn: () => Promise<T>): Promise<T>;
