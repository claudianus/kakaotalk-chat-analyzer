export interface NormalizeKoreanTextOptions {
    keepEnglish?: boolean;
    keepNumbers?: boolean;
    keepPunctuation?: boolean;
    repeatCollapseTo?: number;
}
export declare function normalizeKoreanText(doc: string, options?: NormalizeKoreanTextOptions): string;
