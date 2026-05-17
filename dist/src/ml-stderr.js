const QUIET_PATTERNS = [/Quantization is not supported/i, /Fall back to non-quantized/i];
export function mlStderrQuietEnabled() {
    return process.env.KCA_QUIET_ML === "1";
}
/** @xenova/transformers·ONNX의 반복 stderr 억제 */
export async function withQuietMlStderr(fn) {
    if (!mlStderrQuietEnabled())
        return fn();
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk, encoding, cb) => {
        const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
        if (QUIET_PATTERNS.some((re) => re.test(text))) {
            if (typeof encoding === "function")
                encoding();
            else if (typeof cb === "function")
                cb();
            return true;
        }
        return origWrite(chunk, encoding, cb);
    });
    return fn().finally(() => {
        process.stderr.write = origWrite;
    });
}
//# sourceMappingURL=ml-stderr.js.map