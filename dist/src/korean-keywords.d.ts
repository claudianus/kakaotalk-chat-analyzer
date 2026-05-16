export interface KoreanKeywordOptions {
    senderNames: ReadonlySet<string>;
    exclude?: ReadonlySet<string>;
}
/**
 * 한국어 오픈채팅·구어 특화 키워드 추출
 * - 띄어쓰기·붙여쓰기 혼용, 조사 경계, 2~3어절 구, 해시태그
 * - 붙여쓴 한글 덩어리에서 길이 제한 n-gram 보조
 * - 메시지당 동일 토큰 1회만 (Set)
 */
export declare function extractKoreanKeywords(message: string, options: KoreanKeywordOptions): string[];
/** KR-WordRank 보조: 해시태그만 (슬랭·자모는 WordRank·불용어 층에서 처리) */
export declare function extractSupplementalKeywords(message: string, options: KoreanKeywordOptions): string[];
