const QUIET_PATTERNS = [/Quantization is not supported/i, /Fall back to non-quantized/i];
let quantizationFilterInstalled = false;
function matchesQuietPattern(text) {
    return QUIET_PATTERNS.some((re) => re.test(text));
}
/** ONNX Metal 등에서 나오는 quantization 폴백 메시지는 기본 억제 */
export function ensureMlStderrQuantizationFilter() {
    if (quantizationFilterInstalled)
        return;
    quantizationFilterInstalled = true;
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk, encoding, cb) => {
        const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (matchesQuietPattern(text)) {
            if (typeof encoding === "function")
                encoding();
            else if (typeof cb === "function")
                cb();
            return true;
        }
        return origWrite(chunk, encoding, cb);
    });
}
export function mlStderrQuietEnabled() {
    return process.env.KCA_QUIET_ML === "1";
}
/** 추가 ML stderr 전체 억제(KCA_QUIET_ML=1 시 pipeline 로드 구간) */
export async function withQuietMlStderr(fn) {
    ensureMlStderrQuantizationFilter();
    if (!mlStderrQuietEnabled())
        return fn();
    return fn();
}
//# sourceMappingURL=ml-stderr.js.map