export interface ReportProgressUpdate {
    phase: string;
    current: number;
    total?: number;
}
export declare function logReportProgress(update: ReportProgressUpdate): void;
export declare function resetReportProgress(): void;
