/**
 * Emoji sentiment classification for Korean KakaoTalk chat analysis.
 * Maps common emojis to emotional categories and provides analysis utilities.
 */

export type EmojiCategory =
  | "positive"
  | "negative"
  | "neutral"
  | "love"
  | "anger"
  | "surprise"
  | "sadness"
  | "sticker";

export interface EmojiSentimentResult {
  positive: number;
  negative: number;
  neutral: number;
  love: number;
  anger: number;
  surprise: number;
  sadness: number;
}

const EMOJI_TO_CATEGORY: Record<string, EmojiCategory> = {
  // 긍정/행복 (Positive/Happy)
  "😂": "positive",
  "🤣": "positive",
  "😊": "positive",
  "☺️": "positive",
  "😄": "positive",
  "😃": "positive",
  "😁": "positive",
  "🥰": "positive",
  "😍": "positive",
  "🥳": "positive",
  "🎉": "positive",
  "👍": "positive",
  "🙆‍♂️": "positive",
  "🙆‍♀️": "positive",
  "💯": "positive",
  "🔥": "positive",
  "❤️": "positive",
  "💕": "positive",
  "💖": "positive",
  "💗": "positive",
  "💓": "positive",
  "💞": "positive",
  "💘": "positive",
  "💝": "positive",

  // 슬픔/우울 (Sadness)
  "😢": "sadness",
  "😭": "sadness",
  "😿": "sadness",
  "💔": "sadness",
  "😞": "sadness",
  "😔": "sadness",
  "😟": "sadness",
  "😕": "sadness",
  "🥺": "sadness",

  // 화남/짜증 (Anger)
  "😡": "anger",
  "🤬": "anger",
  "😠": "anger",
  "👿": "anger",
  "😤": "anger",
  "💢": "anger",
  "🖕": "anger",

  // 놀람/충격 (Surprise)
  "😮": "surprise",
  "😯": "surprise",
  "😲": "surprise",
  "😳": "surprise",
  "🤯": "surprise",
  "🙀": "surprise",
  "😱": "surprise",

  // 사랑/애정 (Love)
  "😘": "love",
  "😚": "love",
  "😙": "love",
  "😗": "love",
  "🤗": "love",
  "💑": "love",
  "👩‍❤️‍👨": "love",
  "💏": "love",

  // 동의/응원 (Positive - support/agreement, mapped to positive)
  "👏": "positive",
  "🙌": "positive",
  "🤝": "positive",
  "✊": "positive",
  "🫡": "positive",
  "🙏": "positive",

  // 부정/싫음 (Negative)
  "👎": "negative",
  "🙅‍♂️": "negative",
  "🙅‍♀️": "negative",
  "😒": "negative",
  "😑": "negative",
  "🙄": "negative",
  "😐": "negative",
};

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;

/**
 * Extract all emoji characters from a text string.
 */
export function extractEmojis(text: string): string[] {
  return text.match(EMOJI_REGEX) ?? [];
}

/**
 * Classify a single emoji into an emotional category.
 * Returns "neutral" if the emoji is not in the mapping.
 */
export function classifyEmoji(emoji: string): EmojiCategory {
  return EMOJI_TO_CATEGORY[emoji] ?? "neutral";
}

/**
 * Analyze the sentiment distribution of emojis in a text.
 * Returns counts for each emotional category.
 */
export function analyzeEmojiSentiment(text: string): EmojiSentimentResult {
  const emojis = extractEmojis(text);
  const result: EmojiSentimentResult = {
    positive: 0,
    negative: 0,
    neutral: 0,
    love: 0,
    anger: 0,
    surprise: 0,
    sadness: 0,
  };

  for (const emoji of emojis) {
    const category = classifyEmoji(emoji);
    if (category === "sticker") {
      result.neutral++;
    } else {
      result[category]++;
    }
  }

  return result;
}
