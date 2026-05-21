/**
 * kca 한국어 인코더 플레인 — Hub 원본 id (번들은 ml-bundled-models).
 * 구 Xenova·dragonkue·cringepnh 모델은 사용하지 않습니다.
 */

/** NSMC 이진 감정 — 기본 감정 모델 */
export const HUB_KOELECTRA_NSMC = "daekeun-ml/koelectra-small-v3-nsmc";

/** feature-extraction — quality 시맨틱·임베딩 */
export const HUB_KOELECTRA_EMBED = "monologg/koelectra-small-v3-discriminator";

/** KorSTS 유사도 — balanced 시맨틱 */
export const HUB_KOELECTRA_KORSTS = "daekeun-ml/koelectra-small-v3-korsts";

/** 한국어 IR·임베딩 (ko-embedding-leaderboard 상위권) */
export const HUB_KOREAN_KURE_V1 = "nlpai-lab/KURE-v1";

/** 다국어·한국어 검색 임베딩 — ultra·고RAM */
export const HUB_BGE_M3 = "BAAI/bge-m3";

/** 가용 RAM(GB) 이상이면 Hub KURE-v1 (번들 대신) */
export const SEMANTIC_HEADROOM_KURE_GB = 14;

/** 가용 RAM(GB) 이상이면 Hub BGE-M3 (ultra) */
export const SEMANTIC_HEADROOM_BGE_GB = 20;

/** balanced에서 KURE Hub — 번들 유지 하한 */
export const SEMANTIC_HEADROOM_KURE_BALANCED_GB = 16;

/** 다국어 임베딩 SOTA — IBM Granite R2 (97M, 384dim, 200+ 언어, 32K ctx) */
export const HUB_GRANITE_EMBED_97M = "ibm-granite/granite-embedding-97m-multilingual-r2";

/** 다국어 임베딩 flagship — IBM Granite R2 (311M, 768dim, Matryoshka) */
export const HUB_GRANITE_EMBED_311M = "ibm-granite/granite-embedding-311m-multilingual-r2";

/** 감정 분석 — KR-ELECTRA-small (2024, NSMC fine-tuned) */
export const HUB_KRELECTRA_NSMC = "snunlp/KR-ELECTRA-small";

/** 독성·공격 톤 — KcELECTRA toxic detector (fine-tuned) */
export const HUB_KCELECTRA_TOXICITY = "jinkyeongk/kcELECTRA-toxic-detector";

/** 레거시 독성·공격 톤 (base discriminator, 비권장) */
export const HUB_KCELECTRA_TOXICITY_LEGACY = "monologg/koelectra-base-v3-discriminator";

/** 익명 Hub 401 또는 정책상 금지 — `KCA_*_MODEL` 로만 시도 */
export const DEPRECATED_SENTIMENT_HUB_IDS = [
  "Xenova/bert-base-multilingual-uncased-sentiment",
  "Xenova/distilbert-base-multilingual-cased-sentiment",
  "Xenova/klue-roberta-small-sentiment",
  "Xenova/klue-roberta-base",
  "Xenova/twitter-xlm-roberta-base-sentiment",
  "smilegate-ai/kor_unified_sentiment",
  "cringepnh/koelectra-korean-sentiment",
] as const;

export const DEPRECATED_SEMANTIC_HUB_IDS = [
  "Xenova/multilingual-e5-small",
  "dragonkue/multilingual-e5-small-ko-v2",
  "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
] as const;
