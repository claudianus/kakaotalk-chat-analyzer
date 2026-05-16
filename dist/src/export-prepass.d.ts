import type { UserWord } from "kiwi-nlp";
export interface ExportPrepassResult {
    messageCount: number;
    userWords: UserWord[];
}
/** CSV 1회 읽기: 건수 + Kiwi 사용자 사전 후보 */
export declare function runExportPrepass(filePath: string): Promise<ExportPrepassResult>;
