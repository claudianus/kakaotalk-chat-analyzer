import type { PrivacyMode, ReportData } from "./types.js";
export interface BuildReportOptions {
    privacy?: PrivacyMode;
    top?: number;
    /** false면 메인 스레드만 사용 */
    worker?: boolean;
    /** 집계 중 진행 건수 stderr 출력 */
    progress?: boolean;
    /** true=강제, false=끔, undefined=한국어 방이면 자동 */
    semanticKeywords?: boolean;
    /** YYYY-MM-DD — 이 날짜(포함) 이후 메시지만 집계 */
    since?: string;
}
export declare function shouldUseAnalyzeWorker(filePath: string, options?: BuildReportOptions): Promise<boolean>;
export declare function runAnalyzeWorker(filePath: string, options?: BuildReportOptions): Promise<ReportData>;
