import type { PrivacyMode, ReportBuildTiming, ReportData, ReportProvenance } from "./types.js";
export declare const REPORT_SCHEMA = "2026-05";
export interface BuildReportProvenanceOptions {
    privacy: PrivacyMode;
    top: number;
    since?: string;
    workerRequested?: boolean | "auto";
    workerUsed: boolean;
    semanticRequested?: boolean | "auto";
    kiwiAvailable: boolean;
    buildTiming?: ReportBuildTiming;
    htmlBytes?: number;
}
export declare function parseKcaInvokerEnv(value: string | undefined): ReportProvenance["generator"]["invokedVia"] | undefined;
export declare function buildReportProvenance(data: ReportData, options: BuildReportProvenanceOptions): ReportProvenance;
/** HTML 1회 생성 후 provenance JSON·상세 목록만 갱신 */
export declare function patchReportProvenance(html: string, provenance: ReportProvenance): string;
export declare function formatGeneratorLine(provenance: ReportProvenance): string;
export declare function formatProvenanceDetails(provenance: ReportProvenance): string[];
