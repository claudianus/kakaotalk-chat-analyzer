/** 익명 Hub `config.json` HEAD 가 401 인 구 감정 모델 */
export declare const SENTIMENT_HUB_ANONYMOUS_BLOCKLIST: readonly ["Xenova/bert-base-multilingual-uncased-sentiment", "Xenova/distilbert-base-multilingual-cased-sentiment", "Xenova/klue-roberta-small-sentiment", "Xenova/klue-roberta-base", "Xenova/twitter-xlm-roberta-base-sentiment", "smilegate-ai/kor_unified_sentiment", "cringepnh/koelectra-korean-sentiment"];
export declare function isSentimentHubBlocklisted(modelId: string): boolean;
export declare function assertDefaultSentimentHubAccessible(): void;
