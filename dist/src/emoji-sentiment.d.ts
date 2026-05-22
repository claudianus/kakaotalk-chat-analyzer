/**
 * Emoji sentiment classification for Korean KakaoTalk chat analysis.
 * Maps common emojis to emotional categories and provides analysis utilities.
 */
export type EmojiCategory = "positive" | "negative" | "neutral" | "love" | "anger" | "surprise" | "sadness" | "sticker";
export interface EmojiSentimentResult {
    positive: number;
    negative: number;
    neutral: number;
    love: number;
    anger: number;
    surprise: number;
    sadness: number;
}
/**
 * Extract all emoji characters from a text string.
 */
export declare function extractEmojis(text: string): string[];
/**
 * Classify a single emoji into an emotional category.
 * Returns "neutral" if the emoji is not in the mapping.
 */
export declare function classifyEmoji(emoji: string): EmojiCategory;
/**
 * Analyze the sentiment distribution of emojis in a text.
 * Returns counts for each emotional category.
 */
export declare function analyzeEmojiSentiment(text: string): EmojiSentimentResult;
