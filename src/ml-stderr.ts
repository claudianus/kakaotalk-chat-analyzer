const QUIET_PATTERNS = [/Quantization is not supported/i, /Fall back to non-quantized/i];

let quantizationFilterInstalled = false;

function matchesQuietPattern(text: string): boolean {
  return QUIET_PATTERNS.some((re) => re.test(text));
}

/** ONNX Metal 등에서 나오는 quantization 폴백 메시지는 기본 억제 */
export function ensureMlStderrQuantizationFilter(): void {
  if (quantizationFilterInstalled) return;
  quantizationFilterInstalled = true;
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk, encoding?, cb?) => {
    const text =
      typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (matchesQuietPattern(text)) {
      if (typeof encoding === "function") (encoding as () => void)();
      else if (typeof cb === "function") cb();
      return true;
    }
    return origWrite(chunk, encoding as BufferEncoding | undefined, cb as (() => void) | undefined);
  }) as typeof process.stderr.write;
}

export function mlStderrQuietEnabled(): boolean {
  return process.env.KCA_QUIET_ML === "1";
}

/** 추가 ML stderr 전체 억제(KCA_QUIET_ML=1 시 pipeline 로드 구간) */
export async function withQuietMlStderr<T>(fn: () => Promise<T>): Promise<T> {
  ensureMlStderrQuantizationFilter();
  if (!mlStderrQuietEnabled()) return fn();
  return fn();
}
