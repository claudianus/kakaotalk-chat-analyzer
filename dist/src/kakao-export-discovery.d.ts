export interface KakaoExportFile {
    path: string;
    name: string;
    mtimeMs: number;
    size: number;
}
export interface ResolveKakaoExportOptions {
    /** 검색 폴더 (기본: KCA_CSV_DIR → ~/Downloads) */
    dir?: string;
    /** 0 = 최신, 1 = 두 번째로 최근 … */
    index?: number;
    /** 빈 파일 거부 (기본 1) */
    minBytes?: number;
}
export declare function expandHome(path: string): string;
export declare function defaultKakaoCsvDir(): string;
export declare function listKakaoExports(dir: string): Promise<KakaoExportFile[]>;
export declare function resolveKakaoExport(options?: ResolveKakaoExportOptions): Promise<KakaoExportFile>;
export declare function formatExportPickLine(file: KakaoExportFile, roomName: string): string;
