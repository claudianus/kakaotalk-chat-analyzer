import { formatDate, formatDateTime, partsToUtcMs, weekdayIndex } from "./date.js";
import type {
  ChatRecord,
  CountItem,
  DailyCount,
  DailyHotTopic,
  DailySnapshot,
  EncodingName,
  ParticipantStat,
  ParsedDateParts,
  PrivacyMode,
  RecentSnapshot,
  ReportData,
  ReportInsights,
  SentimentStats,
  SmartTopicTrend,
  ToxicityStats,
  TopicTrendItem,
} from "./types.js";
import { parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
import { GapStreamStats, SessionGapStats } from "./gap-stats.js";
import { keywordTokensForRecord } from "./keyword-record-tokens.js";
import { tokenizeForKeywords } from "./keyword-tokenize.js";
import { adaptiveMinCount, StreamingTfidfKeywords } from "./streaming-tfidf-keywords.js";
import { TopicMapAccumulator } from "./topic-map.js";
import { extractHashtagKeywords } from "./korean-hashtags.js";
import { buildKeywordStopwords } from "./keyword-stopwords.js";
import { buildTopicStopwords } from "./topic-stopwords.js";
import { MessageReservoir } from "./message-reservoir.js";
import { SenderMessageReservoir } from "./sender-message-reservoir.js";
import { ProfanityCounter } from "./profanity.js";
import {
  sentimentReservoirCap,
  sentimentSampleCap,
  subsampleSentimentRecords,
} from "./sentiment-policy.js";
import { extractMemorableMoments } from "./memorable-moments.js";
import {
  effectiveSemanticSampleCap,
  semanticReservoirCap,
  subsampleSemanticMessages,
} from "./semantic-policy.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { getAttachmentMarkers, shouldExtractKeywords } from "./keyword-eligibility.js";
import { mergeDualLaneKeywords } from "./keyword-rank-dual.js";
import { shopSearchDisplayTop } from "./report-config.js";
import { isNoiseKeyword } from "./keyword-quality.js";
import { KeywordCounter } from "./keyword-counter.js";
import { RepeatPhraseCounter } from "./repeat-phrase-counter.js";
import { extractEmojis, classifyEmoji } from "./emoji-sentiment.js";
import {
  buildRoomPulse,
  computeActivityArc,
  computeBurstDays,
  computeConversationPace,
  resolveBurstDetectionMethod,
} from "./report-enrichment.js";
import {
  isOpenChatBoilerplate,
  splitMessageForAnalysis,
  SYSTEM_NOTICE_KEYWORD_STOP,
  type SystemNoticeKind,
} from "./system-notices.js";
import { buildReportStory } from "./story.js";
import { DyadAccumulator } from "./dyad-matrix.js";
import { buildEventSpine } from "./event-spine.js";
import { analyzeHonorificStyle } from "./honorific-analyzer.js";
import { buildRoomNarrative } from "./room-narrative.js";
import { buildPeriodCompare } from "./period-compare.js";
import { buildBenchmarkBandsFromValues } from "./benchmark-bands.js";
import { semanticItemsToTopics } from "./embedding-topics.js";
import { buildKeywordSeedTopics } from "./keyword-seed-topics.js";
import { mergeTopicLanes } from "./topic-merge.js";
import { chooseTopicTrendGranularity } from "./report-chart-util.js";
import type { ExplorerPayload, ParticipantRole } from "./types.js";

import {
  buildHighlights,
  buildParticipantRoles,
  buildRoomEventStats,
  buildSenderLabels,
  computeDaypartPercents,
  computeDensityFromSpan,
  computeGini,
  computeRhythmScore,
  computeTop3Share,
  domainEntropyBits,
  formatDayMdHighlight,
  getDomains,
  getParticipantStat,
  increment,
  inferRoomRelationship,
  longestDateStreak,
  maxSilenceGapDays,
  medianSorted,
  normalizeToken,
  pad2,
  round,
  splitMonthlyKeywordBuckets,
  top1ShareFromCounts,
  topCounts,
  topDailyLinkSpikes,
  typeRichnessFromKeywords,
} from "./accumulator/aggregator-helpers.js";

const ATTACHMENT_MARKERS = [
  "사진",
  "동영상",
  "파일",
  "이모티콘",
  "지도",
  "연락처",
  "투표",
  "공유",
  "음성메시지",
  "삭제된 메시지",
] as const;

const KEYWORD_EXCLUDE = new Set<string>([...ATTACHMENT_MARKERS, ...SYSTEM_NOTICE_KEYWORD_STOP]);
const DISPLAY_KEYWORD_STOPWORDS = buildKeywordStopwords();
const PURE_LAUGH_RE = /^[ㅋㅎㅠㅜ]+$/u;
const PLAN_SIGNAL_RE =
  /(?:\d{1,2}\s*월|\d{1,2}\s*일|내일|모레|다음\s*주|오전|오후|저녁|점심|몇\s*시|\d{1,2}:\d{2})/u;
const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4, 5]);
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const LAUGH_RE = /(?:ㅋ{2,}|ㅎ{2,}|ㅠ+|ㅜ+|ㅇㅇ|ㅋㅋ|ㅎㅎ|ㅋㅎ|ㅎㅋ)/;
const LINK_HINT_RE = /https?:\/\/|www\./i;
const HAS_TOKEN_CHAR_RE = /[가-힣A-Za-z]/;
const DAILY_CONTEXT_SAMPLE_LIMIT = 18;
const DAILY_EVIDENCE_LIMIT = 5;
const CONTEXT_TOPIC_STOPWORDS = new Set([
  "오늘", "내일", "지금", "방금", "저거", "이거", "그거", "저도", "제가", "혹시", "그냥", "진짜", "약간", "관련",
  "http", "https", "링크", "사진", "영상", "이모티콘",
]);

function isDisplayKeywordToken(token: string): boolean {
  const label = normalizeToken(token);
  if (label.length < 2) return false;
  if (KEYWORD_EXCLUDE.has(label) || DISPLAY_KEYWORD_STOPWORDS.has(label)) return false;
  return !isNoiseKeyword(label);
}

function displayKeywordTokens(tokens: string[]): string[] {
  return tokens.map((token) => normalizeToken(token)).filter(isDisplayKeywordToken);
}

interface DailyContextSample {
  text: string;
  sender: string;
  score: number;
  hasAttachment: boolean;
  hasLink: boolean;
  hasPlan: boolean;
  hasQuestion: boolean;
  hasLaugh: boolean;
}

function cleanContextText(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "링크")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "이메일")
    .replace(/\d{5,}/g, "숫자")
    .replace(/\s+/g, " ")
    .trim();
}

function trimEvidenceText(text: string, limit = 56): string {
  const cleaned = cleanContextText(text);
  return cleaned.length > limit ? `${cleaned.slice(0, limit - 1)}…` : cleaned;
}

function scoreContextSample(text: string, flags: Omit<DailyContextSample, "text" | "sender" | "score">): number {
  const lengthScore = Math.min(40, Math.max(0, text.length));
  return lengthScore
    + (flags.hasPlan ? 18 : 0)
    + (flags.hasQuestion ? 10 : 0)
    + (flags.hasAttachment ? 10 : 0)
    + (flags.hasLink ? 8 : 0)
    + (flags.hasLaugh ? 5 : 0);
}

function topicTitleFromKeywords(keywords: string[]): string {
  if (keywords.length >= 2) return `${keywords.slice(0, 2).join("·")} 이야기`;
  if (keywords.length === 1) return `${keywords[0]} 이야기`;
  return "대화 흐름";
}

function deriveKeywordsFromSamples(samples: DailyContextSample[]): string[] {
  const counts = new Map<string, number>();
  for (const sample of samples.slice(0, 10)) {
    for (const token of tokenizeForKeywords(sample.text).slice(0, 12)) {
      const normalized = normalizeToken(token);
      if (normalized.length < 2 || CONTEXT_TOPIC_STOPWORDS.has(normalized) || isNoiseKeyword(normalized)) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([label]) => label);
}

function countContextSignals(samples: DailyContextSample[]): { label: string; count: number }[] {
  const counts = [
    { label: "일정 조율", count: samples.filter((s) => s.hasPlan).length },
    { label: "질문·답변", count: samples.filter((s) => s.hasQuestion).length },
    { label: "자료 공유", count: samples.filter((s) => s.hasAttachment || s.hasLink).length },
    { label: "웃음·반응", count: samples.filter((s) => s.hasLaugh).length },
  ];
  return counts.filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
}

function representativeEvidence(samples: DailyContextSample[], keywords: string[]): string[] {
  const lowered = keywords.map((k) => k.toLowerCase());
  const ranked = [...samples]
    .sort((a, b) => {
      const aHit = lowered.some((k) => a.text.toLowerCase().includes(k)) ? 1 : 0;
      const bHit = lowered.some((k) => b.text.toLowerCase().includes(k)) ? 1 : 0;
      return bHit - aHit || b.score - a.score;
    })
    .slice(0, 2)
    .map((s) => trimEvidenceText(s.text))
    .filter(Boolean);
  return [...new Set(ranked)].map((s) => `대표 흐름: ${s}`);
}

function buildDailyHotTopic(args: {
  date: string;
  keywords: string[];
  messageCount: number;
  avgDailyMessages: number;
  samples: DailyContextSample[];
  participantAliases: string[];
  isBurst: boolean;
}): DailyHotTopic {
  const lift = round(args.messageCount / Math.max(args.avgDailyMessages, 1), 1);
  const keywords = args.keywords.length > 0 ? args.keywords : deriveKeywordsFromSamples(args.samples);
  const signals = countContextSignals(args.samples);
  const signalText = signals.slice(0, 3).map((s) => `${s.label} ${s.count}건`).join(" · ");
  const keywordText = keywords.slice(0, 4).join(" · ");
  const title = keywords.length > 0
    ? topicTitleFromKeywords(keywords)
    : signals[0]
      ? `${signals[0].label} 중심 대화`
      : "대화 급증일";
  const summary = keywords.length > 0
    ? `${keywordText} 관련 언급이 모였고${signalText ? `, ${signalText} 흐름이 함께 보입니다` : " 그 주제가 반복됐습니다"}.`
    : args.isBurst
      ? `평소보다 ${lift}배 많은 메시지가 오갔지만, 뚜렷한 키워드보다 ${signalText || "짧은 반응"}이 중심이었습니다.`
      : `${signalText || "짧은 대화"} 중심으로 이어진 날입니다.`;
  const evidence = [
    keywordText ? `주요 언급: ${keywordText}` : "",
    args.participantAliases.length > 0 ? `주도 참여자: ${args.participantAliases.slice(0, 3).join(" · ")}` : "",
    signalText ? `대화 단서: ${signalText}` : "",
    ...representativeEvidence(args.samples, keywords),
  ].filter(Boolean).slice(0, DAILY_EVIDENCE_LIMIT);
  return {
    date: args.date,
    title,
    keywords,
    summary,
    evidence,
    messageCount: args.messageCount,
    lift,
    participants: args.participantAliases,
  };
}

function dateKeyToUtcMs(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function isoWeekKey(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  // ISO week: the week belongs to the year containing its Thursday.
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const weekYear = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(weekYear, 0, 1));
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return `${weekYear}-W${pad2(weekNum)}`;
}

function trendItemsFromBuckets(buckets: Map<string, KeywordCounter>, topicLimit = 6): TopicTrendItem[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      topics: bucket.topCounts(topicLimit).map((item) => ({ name: item.label, value: item.count })),
    }))
    .filter((t) => t.topics.length > 0);
}

function buildDailyTopicTrend(dailyKeywordBuckets: Map<string, KeywordCounter>): TopicTrendItem[] {
  return trendItemsFromBuckets(dailyKeywordBuckets, 6);
}

function buildWeeklyTopicTrend(dailyKeywordBuckets: Map<string, KeywordCounter>): TopicTrendItem[] {
  const weekBuckets = new Map<string, KeywordCounter>();
  for (const [dateStr, bucket] of dailyKeywordBuckets) {
    const weekKey = isoWeekKey(dateStr);
    let wb = weekBuckets.get(weekKey);
    if (!wb) {
      wb = new KeywordCounter();
      weekBuckets.set(weekKey, wb);
    }
    for (const item of bucket.topCounts(20)) wb.addHits(item.label, item.count);
  }
  return trendItemsFromBuckets(weekBuckets, 6);
}

function buildMonthlyTopicTrend(dailyKeywordBuckets: Map<string, KeywordCounter>): TopicTrendItem[] {
  const monthBuckets = new Map<string, KeywordCounter>();
  for (const [dateStr, bucket] of dailyKeywordBuckets) {
    const monthKey = dateStr.slice(0, 7);
    let mb = monthBuckets.get(monthKey);
    if (!mb) {
      mb = new KeywordCounter();
      monthBuckets.set(monthKey, mb);
    }
    for (const item of bucket.topCounts(20)) mb.addHits(item.label, item.count);
  }
  return trendItemsFromBuckets(monthBuckets, 6);
}

function pickSmartTopicTrend(args: {
  daily: TopicTrendItem[];
  weekly: TopicTrendItem[];
  monthly: TopicTrendItem[];
  activeDays: number;
  spanDays: number;
}): SmartTopicTrend | null {
  const preferred = chooseTopicTrendGranularity({
    activeDays: args.activeDays,
    spanDays: args.spanDays,
  });
  if (preferred === "daily" && args.daily.length >= 2) {
    return {
      granularity: "daily",
      label: "토픽 트렌드 · 일간 키워드",
      hint: "짧은 대화는 날짜별 상위 키워드 변화가 가장 의미 있습니다.",
      items: args.daily,
    };
  }
  if (preferred === "weekly" && args.weekly.length >= 2) {
    return {
      granularity: "weekly",
      label: "토픽 트렌드 · 주간 키워드",
      hint: "몇 주~몇 달 대화는 주차별 키워드 변화로 흐름을 봅니다.",
      items: args.weekly,
    };
  }
  if (preferred === "monthly" && args.monthly.length >= 2) {
    return {
      granularity: "monthly",
      label: "토픽 트렌드 · 월간 키워드",
      hint: "긴 보관 내역은 월 단위로 큰 흐름만 압축해 보여줍니다.",
      items: args.monthly,
    };
  }
  if (args.weekly.length >= 2) {
    return {
      granularity: "weekly",
      label: "토픽 트렌드 · 주간 키워드",
      hint: "주차별 상위 키워드 등장 횟수 변화입니다.",
      items: args.weekly,
    };
  }
  if (args.daily.length >= 2) {
    return {
      granularity: "daily",
      label: "토픽 트렌드 · 일간 키워드",
      hint: "날짜별 상위 키워드 등장 횟수 변화입니다.",
      items: args.daily,
    };
  }
  if (args.monthly.length >= 2) {
    return {
      granularity: "monthly",
      label: "토픽 트렌드 · 월간 키워드",
      hint: "긴 보관 내역은 월 단위로 큰 흐름만 압축해 보여줍니다.",
      items: args.monthly,
    };
  }
  return null;
}

/** 규칙 기반 감정 키워드 — 긍정/부정/중립 분류 */
const POSITIVE_PATTERNS = [
  /(?:\b|[^가-힣A-Za-z])(ㅋㅋ|ㅎㅎ|ㅋㅎ|ㅎㅋ)(?:\b|[^가-힣A-Za-z])/gu,
  /(?:좋아요|고마워|감사|축하|대박|신나|기쁘|행복|재미|재밌|웃겨|웃기|ㅇㅋ|ㅇㅇ|넵|예|굿|좋|최고|멋|잘했|잘하|사랑|귀엽|예쁘|잘생|대단|훌륭|완벽|만세|ㅊㅋ|파이팅|화이팅|감동|행복|신난다|대단|베스트|예쁘다|멋지|잘한다|고마워|ㅋㅋㅋ|ㅎㅎㅎ)/gu,
];
const NEGATIVE_PATTERNS = [
  /(?:싫어|짜증|화나|분노|슬퍼|우울|걱정|불안|화가|엽나|빡|ㅅㅂ|ㅆㅂ|졌나|씨발|시발|지랄|미친|병신|개같|극혐|싫|나쁘|별로|안돼|큰일|문제|실패|어렵|힘들|짜증|귀찮|쓸데없|헛소리|비아냥|까|디스|따져|몰라|관심없|지겹|답답|후회|실망|분통|개빡|열|지치|괴롭|울고|눈물|죽겠|죽음)/gu,
];

function classifySentiment(text: string): { positive: number; negative: number; neutral: number } {
  let positive = 0;
  let negative = 0;
  for (const re of POSITIVE_PATTERNS) {
    const m = text.match(re);
    if (m) positive += m.length;
  }
  for (const re of NEGATIVE_PATTERNS) {
    const m = text.match(re);
    if (m) negative += m.length;
  }
  // 중립 = 메시지 1건으로 카운트하되, 긍정/부정이 없으면 neutral 1
  if (positive === 0 && negative === 0) {
    return { positive: 0, negative: 0, neutral: 1 };
  }
  return { positive, negative, neutral: 0 };
}

function computeEnergy(positive: number, negative: number, neutral: number): number {
  const total = positive + negative + neutral;
  if (total === 0) return 0;
  // 긍정 100%, 부정 0% → +100; 부정 100%, 긍정 0% → -100
  return Math.round(((positive - negative) / total) * 100);
}

export interface FinalizeSourceMeta {
  filePath: string;
  encoding: EncodingName;
  physicalLines: number;
  warningCount: number;
}

export interface FinalizeOptions {
  usedSemanticKeywords?: boolean;
  usedSentimentAnalysis?: boolean;
  usedToxicityAnalysis?: boolean;
  koreanPrimary?: boolean;
  useEmbeddingTopics?: boolean;
  semanticSupplementRrfWeight?: number;
  embeddingThemeCap?: number;
}

/** 시맨틱 supplement messageHits 상한 — RRF 독점 방지 */
export function semanticSupplementHitCap(corpusMessages: number): number {
  return Math.min(24, 4 + Math.floor(Math.sqrt(Math.max(corpusMessages, 1))));
}

export interface AggregatorOptions {
  /** 시맨틱 키워드용 메시지 샘플 수집 */
  semanticSamples?: boolean;
  /** 감정 분석용 메시지 샘플 수집 */
  sentimentSamples?: boolean;
  /** 시맨틱·감정 리저보어 상한 추정(스트리밍 시 생략 가능) */
  estimatedMessages?: number;
}

interface MutableParticipantStat {
  messages: number;
  characters: number;
  attachmentMessages: number;
  linkMessages: number;
  nightMessages: number;
  maxConsecutive: number;
}

export class ReportAggregator {
  private readonly filePath: string;
  private readonly privacy: PrivacyMode;
  private readonly top: number;

  private readonly senderStats = new Map<string, MutableParticipantStat>();
  private readonly senderNamesNormalized = new Set<string>();
  private readonly sendersRegistered = new Set<string>();
  private readonly daily = new Map<string, number>();
  private readonly monthly = new Map<string, number>();
  private readonly hourly = Array.from({ length: 24 }, () => 0);
  private readonly weekdays = Array.from({ length: 7 }, () => 0);
  private readonly attachments = new Map<string, number>();
  private readonly domains = new Map<string, number>();
  private keywordStream = new StreamingTfidfKeywords();
  private topicMap = new TopicMapAccumulator();
  private readonly keywordSupplement = new KeywordCounter();
  private readonly repeatPhraseCounter = new RepeatPhraseCounter();
  private readonly shopSearchTopics = new Map<string, number>();
  private readonly gapStats = new GapStreamStats();
  private readonly sessionGapStats = new SessionGapStats();
  private readonly dailySenderCounts = new Map<string, Map<string, number>>();
  private readonly laughBySender = new Map<string, number>();
  private readonly shortBySender = new Map<string, number>();
  private readonly dailyJoin = new Map<string, number>();
  private readonly dailyLeave = new Map<string, number>();
  private readonly dailyHidden = new Map<string, number>();
  private readonly dailyKick = new Map<string, number>();
  private readonly dailyNewSenders = new Map<string, number>();
  private readonly dailyLinks = new Map<string, number>();
  private readonly dailyPlanSignals = new Map<string, number>();
  private readonly monthlyKeywordBuckets = new Map<string, KeywordCounter>();
  private readonly dailyKeywordBuckets = new Map<string, KeywordCounter>();
  private readonly dailyContextSamples = new Map<string, DailyContextSample[]>();
  private readonly dyads = new DyadAccumulator();
  private readonly dailySentimentCounters = new Map<string, { positive: number; negative: number; neutral: number }>();
  private readonly dailyHourly = new Map<string, number[]>();
  private readonly senderHonorificCounts = new Map<string, { honorific: number; casual: number; neutral: number }>();
  private readonly senderEmojiCounts = new Map<string, Map<string, number>>();

  private total = 0;
  private totalCharacters = 0;
  private messagesWithLinks = 0;
  private messagesWithAttachments = 0;
  private nightMessages = 0;
  private emojiMessages = 0;
  private emojiSentimentCounts = {
    positive: 0, negative: 0, neutral: 0,
    love: 0, anger: 0, surprise: 0, sadness: 0
  };
  private topEmojis = new Map<string, number>();
  private weekendMessages = 0;
  private questionMessages = 0;
  private speakerSwitches = 0;
  private monologueMessages = 0;
  private laughMessages = 0;
  private shortMessages = 0;
  private roomJoinMessages = 0;
  private roomLeaveMessages = 0;
  private roomDeletedMessages = 0;
  private roomHiddenMessages = 0;
  private roomKickMessages = 0;
  private roomSlowOnMessages = 0;
  private roomSlowOffMessages = 0;
  private roomSubManagerMessages = 0;
  private roomManagerMessages = 0;
  private roomShopSearchMessages = 0;
  private shopSearchUntaggedNotices = 0;
  private readonly shopSearchMissSamples: string[] = [];
  private roomPhotoBundleMessages = 0;
  private pureLaughMessages = 0;
  private openChatBoilerplateExcluded = 0;
  private semanticThemeCandidates: { label: string; messageHits: number; score: number }[] = [];
  private readonly semanticReservoir: MessageReservoir | null;
  private readonly sentimentReservoir: SenderMessageReservoir | null;
  private readonly profanityCounter: ProfanityCounter;
  private sentimentStats: SentimentStats | null = null;
  private toxicityStats: ToxicityStats | null = null;
  /** stats pass에서 리저보어를 채웠으면 keyword pass 중복 push 방지 */
  private samplesCollectedInStatsPass = false;

  private prevMs: number | null = null;
  private prevSender: string | null = null;
  private runSender: string | null = null;
  private runLen = 0;
  private firstDate: ParsedDateParts | null = null;
  private lastDate: ParsedDateParts | null = null;

  private readonly replyLatencyByResponder = new Map<string, number[]>();
  private readonly pendingQuestions: { asker: string; time: number; answered: boolean; answerer: string | null; latencyMinutes: number | null }[] = [];
  private readonly questionAnswerPairs = new Map<string, { questions: number; latencies: number[] }>();
  private readonly answererCounts = new Map<string, number>();

  constructor(filePath: string, privacy: PrivacyMode, top: number, options?: AggregatorOptions) {
    this.filePath = filePath;
    this.privacy = privacy;
    this.top = top;
    // 임베딩 상한은 applySemanticKeywords → extractSemanticKeywords(corpusMessages)와 동일 정책
    this.semanticReservoir = options?.semanticSamples
      ? new MessageReservoir(semanticReservoirCap(options?.estimatedMessages))
      : null;
    this.sentimentReservoir = options?.sentimentSamples
      ? new SenderMessageReservoir(sentimentReservoirCap(options?.estimatedMessages))
      : null;
    this.profanityCounter = ProfanityCounter.create();
  }

  /** 스트리밍 1패스 후 실제 건수로 리저보어 상한 보정(추정치 과소 시) */
  ensureSampleCaps(messageCount: number): void {
    if (messageCount <= 0) return;
    const semNeed = semanticReservoirCap(messageCount);
    const sentNeed = sentimentReservoirCap(messageCount);
    if (this.semanticReservoir && this.semanticReservoir.capacity() < semNeed) {
      this.semanticReservoir.growTo(semNeed);
    }
    if (this.sentimentReservoir && this.sentimentReservoir.capacity() < sentNeed) {
      this.sentimentReservoir.growTo(sentNeed);
    }
  }

  drainSemanticSamples(buildOptions?: BuildReportOptions): string[] {
    const raw = this.semanticReservoir?.drain() ?? [];
    if (raw.length === 0) return raw;
    const cap = effectiveSemanticSampleCap(Math.max(this.total, raw.length), buildOptions);
    return subsampleSemanticMessages(raw, cap);
  }

  drainSentimentSamples(): { text: string; sender: string }[] {
    const raw = this.sentimentReservoir?.drain() ?? [];
    if (raw.length === 0) return raw;
    const cap = sentimentSampleCap(Math.max(this.total, raw.length));
    return subsampleSentimentRecords(raw, cap);
  }

  applySentimentStats(stats: SentimentStats): void {
    this.sentimentStats = stats;
  }

  applyToxicityStats(stats: ToxicityStats): void {
    this.toxicityStats = stats;
  }

  senderAliasMap(): Map<string, string> {
    return buildSenderLabels([...this.senderStats.keys()], this.privacy);
  }

  messageCount(): number {
    return this.total;
  }

  resetKeywordPipeline(): void {
    this.keywordStream = new StreamingTfidfKeywords();
    this.topicMap = new TopicMapAccumulator();
  }

  markSamplesCollectedInStatsPass(): void {
    this.samplesCollectedInStatsPass = true;
  }

  applyKeywordTokens(kwTokens: string[], monthKey: string, dayKey?: string): void {
    this.keywordStream.addDocumentTokens(kwTokens);
    this.topicMap.addMessage(kwTokens, monthKey);
    const displayTokens = displayKeywordTokens(kwTokens);
    let monthBucket = this.monthlyKeywordBuckets.get(monthKey);
    if (!monthBucket) {
      monthBucket = new KeywordCounter();
      this.monthlyKeywordBuckets.set(monthKey, monthBucket);
    }
    for (const t of displayTokens) monthBucket.add(t);
    // 일별 키워드 버킷 (dayKey가 제공된 경우)
    if (dayKey) {
      let dayBucket = this.dailyKeywordBuckets.get(dayKey);
      if (!dayBucket) {
        dayBucket = new KeywordCounter();
        this.dailyKeywordBuckets.set(dayKey, dayBucket);
      }
      for (const t of displayTokens) dayBucket.add(t);
    }
  }

  private pushAnalysisSamples(msg: string, sender: string, messageLength: number, isPureSystem: boolean): void {
    if (isPureSystem || isOpenChatBoilerplate(msg)) return;
    if (this.sentimentReservoir && messageLength >= 12) {
      this.sentimentReservoir.push(msg, sender);
    }
  }

  private pushSemanticSample(msg: string, messageLength: number): void {
    if (this.semanticReservoir && messageLength >= 12) this.semanticReservoir.push(msg);
  }

  private consumeKeywords(record: ChatRecord): void {
    const row = keywordTokensForRecord(record);
    if (!row) {
      const split = splitMessageForAnalysis(record.message);
      const msg = split.userText.length > 0 ? split.userText : record.message;
      if (isOpenChatBoilerplate(msg)) this.openChatBoilerplateExcluded += 1;
      return;
    }
    this.applyKeywordTokens(row.tokens, row.monthKey, row.dayKey);
    if (!this.samplesCollectedInStatsPass) {
      const split = splitMessageForAnalysis(record.message);
      const msg = split.userText.length > 0 ? split.userText : record.message;
      this.pushSemanticSample(msg, msg.length);
    }
  }

  applySemanticKeywordBoost(items: { label: string; messageHits: number; score?: number }[]): void {
    const valid = items.filter((item) => !isNoiseKeyword(item.label));
    this.semanticThemeCandidates = valid.map((item) => ({
      label: item.label,
      messageHits: item.messageHits,
      score: item.score ?? item.messageHits,
    }));
  }

  /** finalize 직전 — BM25 후보에만 시맨틱 RRF 보강(표시 빈도는 코퍼스 df) */
  applySemanticSupplementForRanked(wordRankItems: { label: string; messageHits: number }[]): void {
    const allowed = new Map(wordRankItems.map((item) => [item.label, item.messageHits]));
    for (const item of this.semanticThemeCandidates) {
      const corpusHits = allowed.get(item.label);
      if (corpusHits === undefined) continue;
      this.keywordSupplement.addHits(item.label, corpusHits);
    }
  }

  private collectDailyContextSample(
    dayKey: string,
    msg: string,
    sender: string,
    flags: Omit<DailyContextSample, "text" | "sender" | "score">,
  ): void {
    const text = cleanContextText(msg);
    if (text.length < 4 || PURE_LAUGH_RE.test(text)) return;
    const sample: DailyContextSample = {
      text,
      sender,
      score: scoreContextSample(text, flags),
      ...flags,
    };
    const samples = this.dailyContextSamples.get(dayKey) ?? [];
    samples.push(sample);
    samples.sort((a, b) => b.score - a.score || b.text.length - a.text.length);
    if (samples.length > DAILY_CONTEXT_SAMPLE_LIMIT) samples.length = DAILY_CONTEXT_SAMPLE_LIMIT;
    this.dailyContextSamples.set(dayKey, samples);
  }

  consume(
    record: ChatRecord,
    opts?: { keywordsOnly?: boolean; skipKeywords?: boolean; collectSamples?: boolean },
  ): void {
    if (opts?.keywordsOnly) {
      this.consumeKeywords(record);
      return;
    }
    const dayKey = formatDate(record.date);
    const stat = getParticipantStat(this.senderStats, record.sender);
    if (!this.sendersRegistered.has(record.sender)) {
      this.sendersRegistered.add(record.sender);
      this.senderNamesNormalized.add(normalizeToken(record.sender));
      increment(this.dailyNewSenders, dayKey);
    }
    const split = splitMessageForAnalysis(record.message);
    for (const kind of split.notices) this.bumpSystemNotice(kind, dayKey);
    for (const tag of split.shopSearchTags) increment(this.shopSearchTopics, tag);
    if (split.notices.includes("shopSearch") && split.shopSearchTags.length === 0) {
      this.shopSearchUntaggedNotices += 1;
      if (this.shopSearchMissSamples.length < 8) {
        const sample = record.message.trim().slice(0, 120).replace(/\s+/g, " ");
        if (sample) this.shopSearchMissSamples.push(sample);
      }
    }

    const msg = split.userText.length > 0 ? split.userText : record.message;
    const messageLength = msg.length;
    const isPureSystem = split.notices.length > 0 && split.userText.length === 0;

    const foundAttachments = getAttachmentMarkers(msg);
    const foundDomains = LINK_HINT_RE.test(msg) ? getDomains(msg) : [];
    const ms = partsToUtcMs(record.date);

    if (this.firstDate === null) this.firstDate = record.date;
    this.lastDate = record.date;
    this.total += 1;

    const wi = weekdayIndex(record.date);

    if (!isPureSystem) {
      this.collectDailyContextSample(dayKey, msg, record.sender, {
        hasAttachment: foundAttachments.length > 0,
        hasLink: foundDomains.length > 0,
        hasPlan: PLAN_SIGNAL_RE.test(msg),
        hasQuestion: msg.includes("?") || msg.includes("？"),
        hasLaugh: LAUGH_RE.test(msg),
      });

      if (messageLength > 0 && EMOJI_RE.test(msg)) {
        this.emojiMessages += 1;
        const emojis = extractEmojis(msg);
        for (const emoji of emojis) {
          const cat = classifyEmoji(emoji);
          this.emojiSentimentCounts[cat as keyof typeof this.emojiSentimentCounts]++;
          this.topEmojis.set(emoji, (this.topEmojis.get(emoji) || 0) + 1);
          // sender별 이모지 집계
          if (!this.senderEmojiCounts.has(record.sender)) {
            this.senderEmojiCounts.set(record.sender, new Map());
          }
          const senderEmojis = this.senderEmojiCounts.get(record.sender)!;
          senderEmojis.set(emoji, (senderEmojis.get(emoji) || 0) + 1);
        }
      }

      if (messageLength > 0 && LAUGH_RE.test(msg)) {
        this.laughMessages += 1;
        increment(this.laughBySender, record.sender);
      }
      if (messageLength > 0 && PURE_LAUGH_RE.test(msg.trim())) {
        this.pureLaughMessages += 1;
      }

      const trimmed = msg.trim();
      if (trimmed.length > 0 && trimmed.length <= 3) {
        this.shortMessages += 1;
        increment(this.shortBySender, record.sender);
      }

      if (msg.includes("?") || msg.includes("？")) {
        this.questionMessages += 1;
      }

      if (wi === 0 || wi === 6) {
        this.weekendMessages += 1;
      }

      if (NIGHT_HOURS.has(record.date.hour)) {
        this.nightMessages += 1;
        stat.nightMessages += 1;
      }

      if (this.prevMs !== null) {
        const delta = ms - this.prevMs;
        this.gapStats.add(delta);

        // 응답 지연 지문: 직전 메시지가 다른 사람이면 현재 발신자의 응답 시간
        if (this.prevSender !== null && record.sender !== this.prevSender) {
          const latencyMin = delta / 60_000;
          const list = this.replyLatencyByResponder.get(record.sender) ?? [];
          list.push(latencyMin);
          this.replyLatencyByResponder.set(record.sender, list);
        }
      }
      this.sessionGapStats.addMessage(ms);
      this.prevMs = ms;

      if (this.prevSender !== null && record.sender !== this.prevSender) {
        this.speakerSwitches += 1;
        this.dyads.addReply(this.prevSender, record.sender);
      }

      // 질문-응답 토폴로지: 최근 질문에 다른 사람이 60분 내 답변하면 카운트
      const isQuestion = msg.includes("?") || msg.includes("？");
      if (this.prevSender !== null && record.sender !== this.prevSender && !isQuestion) {
        const cutoff = ms - 60 * 60 * 1000;
        const idx = this.pendingQuestions.findIndex(
          (q) => !q.answered && q.asker !== record.sender && q.time >= cutoff,
        );
        if (idx >= 0) {
          const q = this.pendingQuestions[idx]!;
          q.answered = true;
          q.answerer = record.sender;
          q.latencyMinutes = (ms - q.time) / 60_000;
          const key = `${q.asker}\u0001${record.sender}`;
          const pair = this.questionAnswerPairs.get(key) ?? { questions: 0, latencies: [] };
          pair.questions += 1;
          pair.latencies.push(q.latencyMinutes);
          this.questionAnswerPairs.set(key, pair);
          increment(this.answererCounts, record.sender);
        }
      }
      if (isQuestion) {
        this.pendingQuestions.push({ asker: record.sender, time: ms, answered: false, answerer: null, latencyMinutes: null });
        if (this.pendingQuestions.length > 50) this.pendingQuestions.shift();
      }

      if (PLAN_SIGNAL_RE.test(msg)) {
        increment(this.dailyPlanSignals, dayKey);
      }

      if (record.sender === this.prevSender) {
        this.runLen += 1;
        if (this.runLen >= 3) {
          this.monologueMessages += 1;
        }
      } else {
        if (this.prevSender !== null && this.runSender !== null) {
          const prevStat = getParticipantStat(this.senderStats, this.prevSender);
          prevStat.maxConsecutive = Math.max(prevStat.maxConsecutive, this.runLen);
        }
        this.runSender = record.sender;
        this.runLen = 1;
      }
      this.prevSender = record.sender;

      stat.messages += 1;
      stat.characters += messageLength;
      this.totalCharacters += messageLength;

      if (foundAttachments.length > 0) {
        stat.attachmentMessages += 1;
        this.messagesWithAttachments += 1;
        for (const marker of foundAttachments) increment(this.attachments, marker);
      }

      if (foundDomains.length > 0) {
        stat.linkMessages += 1;
        this.messagesWithLinks += 1;
        increment(this.dailyLinks, dayKey);
        for (const domain of foundDomains) increment(this.domains, domain);
      }

      if (!isPureSystem && !isOpenChatBoilerplate(msg)) {
        // 존칭/반말 스타일 집계
        const style = analyzeHonorificStyle(msg);
        let hCounts = this.senderHonorificCounts.get(record.sender);
        if (!hCounts) {
          hCounts = { honorific: 0, casual: 0, neutral: 0 };
          this.senderHonorificCounts.set(record.sender, hCounts);
        }
        if (style === "honorific") hCounts.honorific += 1;
        else if (style === "casual") hCounts.casual += 1;
        else hCounts.neutral += 1;

        this.profanityCounter.add(msg, record.sender);
        if (opts?.collectSamples) {
          this.pushAnalysisSamples(msg, record.sender, messageLength, isPureSystem);
        } else if (this.sentimentReservoir && messageLength >= 12) {
          this.sentimentReservoir.push(msg, record.sender);
        }
        // 규칙 기반 일별 감정 카운터 업데이트
        const sent = classifySentiment(msg);
        let daySent = this.dailySentimentCounters.get(dayKey);
        if (!daySent) {
          daySent = { positive: 0, negative: 0, neutral: 0 };
          this.dailySentimentCounters.set(dayKey, daySent);
        }
        daySent.positive += sent.positive;
        daySent.negative += sent.negative;
        daySent.neutral += sent.neutral;
      }

      if (isOpenChatBoilerplate(msg)) {
        this.openChatBoilerplateExcluded += 1;
      } else if (
        messageLength >= 2 &&
        HAS_TOKEN_CHAR_RE.test(msg) &&
        shouldExtractKeywords(msg, foundAttachments)
      ) {
      if (!opts?.skipKeywords) {
        const kwTokens = tokenizeForKeywords(msg);
        this.applyKeywordTokens(kwTokens, `${record.date.year}-${pad2(record.date.month)}`, dayKey);
      }
        if (!opts?.keywordsOnly) {
          const kwOpts = {
            senderNames: this.senderNamesNormalized,
            exclude: KEYWORD_EXCLUDE,
          };
          for (const keyword of extractHashtagKeywords(msg, kwOpts)) {
            this.keywordSupplement.add(keyword);
          }
          if (messageLength >= 12) this.repeatPhraseCounter.add(msg, dayKey);
          if (opts?.collectSamples) {
            this.pushSemanticSample(msg, messageLength);
          } else if (!this.samplesCollectedInStatsPass) {
            this.pushSemanticSample(msg, messageLength);
          }
        } else if (opts?.collectSamples) {
          this.pushSemanticSample(msg, messageLength);
        }
      }
    }

    increment(this.daily, dayKey);
    {
      let dayHours = this.dailyHourly.get(dayKey);
      if (!dayHours) { dayHours = Array(24).fill(0) as number[]; this.dailyHourly.set(dayKey, dayHours); }
      dayHours[record.date.hour] += 1;
    }
    if (!isPureSystem) {
      let perDay = this.dailySenderCounts.get(dayKey);
      if (!perDay) {
        perDay = new Map();
        this.dailySenderCounts.set(dayKey, perDay);
      }
      increment(perDay, record.sender);
    }
    increment(this.monthly, `${record.date.year}-${pad2(record.date.month)}`);
    this.hourly[record.date.hour] = (this.hourly[record.date.hour] ?? 0) + 1;
    this.weekdays[wi] = (this.weekdays[wi] ?? 0) + 1;
  }

  private bumpSystemNotice(kind: SystemNoticeKind, dayKey: string): void {
    switch (kind) {
      case "join":
        this.roomJoinMessages += 1;
        increment(this.dailyJoin, dayKey);
        break;
      case "leave":
        this.roomLeaveMessages += 1;
        increment(this.dailyLeave, dayKey);
        break;
      case "deleted":
        this.roomDeletedMessages += 1;
        break;
      case "hidden":
        this.roomHiddenMessages += 1;
        increment(this.dailyHidden, dayKey);
        break;
      case "kick":
        this.roomKickMessages += 1;
        increment(this.dailyKick, dayKey);
        break;
      case "slowModeOn":
        this.roomSlowOnMessages += 1;
        break;
      case "slowModeOff":
        this.roomSlowOffMessages += 1;
        break;
      case "subManager":
        this.roomSubManagerMessages += 1;
        break;
      case "manager":
        this.roomManagerMessages += 1;
        break;
      case "shopSearch":
        this.roomShopSearchMessages += 1;
        break;
      case "photoBundle":
        this.roomPhotoBundleMessages += 1;
        break;
      default:
        break;
    }
  }

  finalize(meta: FinalizeSourceMeta, finalizeOpts?: FinalizeOptions): ReportData {
    if (this.prevSender !== null && this.runSender !== null) {
      const prevStat = getParticipantStat(this.senderStats, this.prevSender);
      prevStat.maxConsecutive = Math.max(prevStat.maxConsecutive, this.runLen);
    }

    const total = this.total;
    const totalChars = this.totalCharacters;
    const aliases = buildSenderLabels([...this.senderStats.keys()], this.privacy);
    const allParticipants = [...this.senderStats.entries()].map(([raw, stat]): ParticipantStat => {
      const sharePercent = total > 0 ? round((stat.messages / total) * 100, 1) : 0;
      const characterSharePercent =
        totalChars > 0 ? round((stat.characters / totalChars) * 100, 1) : 0;
      return {
        alias: aliases.get(raw) ?? "???",
        messages: stat.messages,
        characters: stat.characters,
        averageLength: round(stat.characters / Math.max(stat.messages, 1), 1),
        attachmentMessages: stat.attachmentMessages,
        linkMessages: stat.linkMessages,
        sharePercent,
        characterSharePercent,
        nightMessages: stat.nightMessages,
        maxConsecutive: stat.maxConsecutive,
      };
    });
    const participantRoles = buildParticipantRoles(
      allParticipants,
      this.laughBySender,
      this.shortBySender,
      aliases,
    );
    const participantStats = [...allParticipants]
      .sort((a, b) => b.messages - a.messages)
      .slice(0, this.top);
    const participantsByCharacters = [...allParticipants]
      .sort((a, b) => b.characters - a.characters || b.messages - a.messages)
      .slice(0, this.top);

    const sortedDays = [...this.daily.keys()].sort();
    const longestStreak = longestDateStreak(sortedDays);
    let peakHour: number | null = null;
    let peakCount = -1;
    for (let h = 0; h < 24; h += 1) {
      const c = this.hourly[h] ?? 0;
      if (c > peakCount) {
        peakCount = c;
        peakHour = h;
      }
    }
    if (peakCount <= 0) peakHour = null;

    let busiestIdx = -1;
    let busiestCount = -1;
    for (let i = 0; i < 7; i += 1) {
      const c = this.weekdays[i] ?? 0;
      if (c > busiestCount) {
        busiestCount = c;
        busiestIdx = i;
      }
    }
    const busiestWeekdayLabel =
      busiestIdx >= 0 && busiestCount > 0 ? `${WEEKDAY_LABELS_KO[busiestIdx] ?? ""}요일` : null;

    const medianMs = this.gapStats.medianMs();
    const medianReplyGapMinutes = medianMs !== null ? round(medianMs / 60_000, 1) : null;

    const nightSharePercent = total > 0 ? round((this.nightMessages / total) * 100, 1) : 0;
    const activeDays = this.daily.size;
    const messagesPerActiveDay = activeDays > 0 ? round(total / activeDays, 1) : 0;

    const allMessageCounts = [...this.senderStats.values()].map((s) => s.messages).sort((a, b) => a - b);
    const participantGini = computeGini(allMessageCounts);
    const p90Ms = this.gapStats.p90Ms();
    const replyGapP90Minutes = p90Ms !== null ? round(p90Ms / 60_000, 1) : null;
    const maxSilenceBetweenActiveDays = maxSilenceGapDays(sortedDays);
    const top3ParticipantSharePercent = computeTop3Share(this.senderStats, total);
    const linkDomainEntropyBits = domainEntropyBits(this.domains);
    const densityMessagesPerCalendarDay = computeDensityFromSpan(this.firstDate, this.lastDate, total);
    const weekendSharePercent = total > 0 ? round((this.weekendMessages / total) * 100, 1) : 0;
    const questionLikeMessagesPer100 = total > 0 ? round((this.questionMessages / total) * 100, 2) : 0;
    const speakerSwitchRatePer100 = total > 0 ? round((this.speakerSwitches / total) * 100, 2) : 0;
    const daypartPercents = computeDaypartPercents(this.hourly, total);
    const rhythmScore = computeRhythmScore({
      gini: participantGini,
      longestStreak,
      density: densityMessagesPerCalendarDay,
    });

    const linksPer100 = total > 0 ? round((this.messagesWithLinks / total) * 100, 2) : 0;
    const attachmentsPer100 = total > 0 ? round((this.messagesWithAttachments / total) * 100, 2) : 0;
    const perParticipantMsgs = [...this.senderStats.values()].map((s) => s.messages);
    const medianMessagesPerParticipant =
      perParticipantMsgs.length > 0
        ? round(medianSorted([...perParticipantMsgs].sort((a, b) => a - b)), 2)
        : null;
    const burstGapUnder1mPercent = this.gapStats.burstUnder1mPercent();
    const gapOver60mPercent = this.gapStats.gapOver60mPercent();
    let activeHoursCount = 0;
    for (let h = 0; h < 24; h += 1) {
      if ((this.hourly[h] ?? 0) > 0) activeHoursCount += 1;
    }
    const keywordStop = buildKeywordStopwords();
    const keywordLimit = Math.max(120, this.top * 3);
    const minDocFreq = adaptiveMinCount(total, finalizeOpts?.koreanPrimary !== false);
    const keywordCandidates = this.keywordStream.collectKeywordCandidates({
      stopwords: keywordStop,
      minDocFreq,
    });
    const bm25LaneForSemantic = [...keywordCandidates]
      .sort((a, b) => b.score - a.score || b.messageHits - a.messageHits)
      .slice(0, Math.min(200, Math.floor(80 + Math.sqrt(Math.max(total, 1)))));
    this.applySemanticSupplementForRanked(bm25LaneForSemantic);
    const kwMerged = mergeDualLaneKeywords(
      keywordCandidates,
      this.keywordSupplement,
      total,
      keywordLimit,
      finalizeOpts?.semanticSupplementRrfWeight ?? 0.5,
    );
    const keywords = kwMerged.byFrequency;
    const keywordsDistinctive = kwMerged.distinctive;
    const graphTopics = this.topicMap.buildTopics(total, buildTopicStopwords());
    const keywordTopics = buildKeywordSeedTopics(
      keywords,
      keywordsDistinctive,
      total,
      this.topicMap,
    );
    const semanticTopics =
      finalizeOpts?.useEmbeddingTopics && this.semanticThemeCandidates.length > 0
        ? semanticItemsToTopics(this.semanticThemeCandidates, total, {
            max: finalizeOpts?.embeddingThemeCap,
          })
        : [];
    let topics = mergeTopicLanes(
      { graph: graphTopics, keyword: keywordTopics, semantic: semanticTopics },
      total,
    );
    const burstDetectionMethod = resolveBurstDetectionMethod();
    const keywordTop1SharePercent = top1ShareFromCounts(keywords, total);
    let attachmentMarkerSum = 0;
    for (const c of this.attachments.values()) attachmentMarkerSum += c;
    const photoMarkerCount = this.attachments.get("사진") ?? 0;
    const photoShareOfAllAttachmentMarkers =
      attachmentMarkerSum > 0 ? round((photoMarkerCount / attachmentMarkerSum) * 100, 1) : null;
    let maxDayMessages = 0;
    for (const c of this.daily.values()) maxDayMessages = Math.max(maxDayMessages, c);
    const peakDaySharePercent = total > 0 ? round((maxDayMessages / total) * 100, 1) : 0;
    const uniqueDomainCount = this.domains.size;
    const replyGapCoeffVariation = this.gapStats.coeffVariation();
    const monologueMessagesPercent = total > 0 ? round((this.monologueMessages / total) * 100, 1) : 0;
    const lexicalTypeRichnessPercent = typeRichnessFromKeywords(keywords, total);
    const sessionGap = this.sessionGapStats.finalize();

    const insights: ReportInsights = {
      weekendSharePercent,
      participantGini,
      replyGapP90Minutes,
      maxSilenceBetweenActiveDays,
      top3ParticipantSharePercent,
      linkDomainEntropyBits,
      densityMessagesPerCalendarDay,
      questionLikeMessagesPer100,
      speakerSwitchRatePer100,
      rhythmScore,
      daypartPercents,
      linksPer100,
      attachmentsPer100,
      medianMessagesPerParticipant,
      burstGapUnder1mPercent,
      gapOver60mPercent,
      activeHoursCount,
      keywordTop1SharePercent,
      photoShareOfAllAttachmentMarkers,
      monologueMessagesPercent,
      peakDaySharePercent,
      uniqueDomainCount,
      replyGapCoeffVariation,
      lexicalTypeRichnessPercent,
      sessionCount: sessionGap.sessionCount,
      avgMessagesPerSession: sessionGap.avgMessagesPerSession,
      medianSessionMinutes: sessionGap.medianSessionMinutes,
    };

    const dailySorted = [...this.daily.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    const burstDays = computeBurstDays(dailySorted);
    const activityArc = computeActivityArc(dailySorted);
    const conversationPace = computeConversationPace(insights);
    const roomPulse = buildRoomPulse(
      sortedDays,
      this.dailyJoin,
      this.dailyLeave,
      this.dailyHidden,
      this.dailyKick,
      this.dailyNewSenders,
    );

    const laughByAlias = new Map<string, number>();
    const shortByAlias = new Map<string, number>();
    for (const [raw, c] of this.laughBySender) {
      const alias = aliases.get(raw);
      if (alias) laughByAlias.set(alias, (laughByAlias.get(alias) ?? 0) + c);
    }
    for (const [raw, c] of this.shortBySender) {
      const alias = aliases.get(raw);
      if (alias) shortByAlias.set(alias, (shortByAlias.get(alias) ?? 0) + c);
    }

    const { headKeywords, tailKeywords } = splitMonthlyKeywordBuckets(this.monthlyKeywordBuckets);
    const periodCompare = buildPeriodCompare({
      activityArc,
      daily: dailySorted,
      monthly: [...this.monthly.entries()].map(([date, count]) => ({ date, count })),
      headKeywords,
      tailKeywords,
    });

    const interaction = this.dyads.buildMatrix(participantStats, aliases);
    const topDyadLabel =
      interaction?.topPairs[0] != null
        ? `${interaction.topPairs[0].fromAlias}→${interaction.topPairs[0].toAlias}`
        : null;

    const timeline = buildEventSpine({
      burstDays,
      daily: dailySorted,
      roomPulse,
      repeatedPhrases: this.repeatPhraseCounter.top(8, 3),
      maxSilenceBetweenActiveDays,
      dailyLinkSpikes: topDailyLinkSpikes(this.dailyLinks),
      dailyPlanSignals: [...this.dailyPlanSignals.entries()]
        .map(([date, hits]) => ({ date, hits }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });

    const story = buildReportStory({
      chatRoomName: parseChatRoomNameFromExportPath(meta.filePath),
      totalMessages: total,
      activeDays,
      firstMessage: this.firstDate ? formatDateTime(this.firstDate) : null,
      lastMessage: this.lastDate ? formatDateTime(this.lastDate) : null,
      longestStreak,
      peakHour,
      busiestWeekdayLabel,
      nightSharePercent,
      emojiMessages: this.emojiMessages,
      participants: participantStats,
      daily: dailySorted,
      dailySenderCounts: this.dailySenderCounts,
      senderAliases: aliases,
      insights,
      laughMessages: this.laughMessages,
      shortMessages: this.shortMessages,
      laughBySender: laughByAlias,
      shortBySender: shortByAlias,
      burstDays,
      activityArc,
      conversationPace,
      roomPulse,
      topics,
    });

    const highlights = buildHighlights({
      total,
      topAlias: participantStats[0]?.alias ?? null,
      topShare: participantStats[0]?.sharePercent ?? null,
      busiestWeekdayLabel,
      peakHour,
      medianReplyGapMinutes,
      nightSharePercent,
      longestStreak,
      emojiMessages: this.emojiMessages,
      messagesWithAttachments: this.messagesWithAttachments,
      weekendSharePercent,
      participantGini,
      replyGapP90Minutes,
      maxSilenceBetweenActiveDays,
      rhythmScore,
      burstGapUnder1mPercent,
      monologueMessagesPercent,
      roomJoinMessages: this.roomJoinMessages,
      roomLeaveMessages: this.roomLeaveMessages,
      roomDeletedMessages: this.roomDeletedMessages,
      roomHiddenMessages: this.roomHiddenMessages,
      roomKickMessages: this.roomKickMessages,
      pureLaughMessages: this.pureLaughMessages,
      repeatedPhraseCount: this.repeatPhraseCounter.top(1, 3)[0]?.count ?? 0,
      burstDays,
      activityArc,
      conversationPace,
      roomPulse,
      lexicalTypeRichnessPercent,
      speakerSwitchRatePer100,
    });

    const narrativeFinal = buildRoomNarrative({
      chatRoomName: parseChatRoomNameFromExportPath(meta.filePath),
      totalMessages: total,
      participants: aliases.size,
      pace: conversationPace,
      insights,
      topics,
      personas: story.personas,
      events: timeline,
      topDyadLabel,
    });

    const explorer: ExplorerPayload = {
      daily: dailySorted,
      hourly: [...this.hourly],
      monthly: [...this.monthly.entries()].map(([date, count]) => ({ date, count })),
      range: {
        min: dailySorted[0]?.date ?? "",
        max: dailySorted[dailySorted.length - 1]?.date ?? "",
      },
    };

    const benchmarks = buildBenchmarkBandsFromValues({
      participantGini,
      nightSharePercent,
      speakerSwitchRatePer100,
      rhythmScore,
      weekendSharePercent,
    });

    const dailySentiment: import("./types.js").DailySentiment[] = dailySorted
      .map((d) => {
        const counters = this.dailySentimentCounters.get(d.date) ?? { positive: 0, negative: 0, neutral: 0 };
        const totalSent = counters.positive + counters.negative + counters.neutral;
        if (totalSent === 0) {
          return { date: d.date, positive: 0, negative: 0, neutral: 100, energy: 0 };
        }
        const positive = round((counters.positive / totalSent) * 100, 1);
        const negative = round((counters.negative / totalSent) * 100, 1);
        const neutral = round(100 - positive - negative, 1);
        const energy = computeEnergy(counters.positive, counters.negative, counters.neutral);
        return { date: d.date, positive, negative, neutral, energy };
      });

    const burstDateSet = new Set(burstDays.map((d) => d.date));
    const avgDailyMessages = dailySorted.length > 0 ? total / dailySorted.length : 0;
    // 최근 7일은 키워드/증거가 없어도 무조건 포함
    const lastDateStr = dailySorted[dailySorted.length - 1]?.date ?? "";
    const recentDateSet = new Set<string>();
    if (lastDateStr) {
      const [ly2, lm2, ld2] = lastDateStr.split("-").map(Number);
      const lastMs2 = Date.UTC(ly2, lm2 - 1, ld2);
      for (let i = 0; i < 7; i++) {
        const dd = new Date(lastMs2 - i * 86_400_000);
        recentDateSet.add(`${dd.getUTCFullYear()}-${pad2(dd.getUTCMonth() + 1)}-${dd.getUTCDate()}`);
      }
    }
    const dailyHotTopics: DailyHotTopic[] = dailySorted
      .map((d) => {
        const bucket = this.dailyKeywordBuckets.get(d.date);
        const topKeywords = bucket ? bucket.topCounts(4).map((item) => item.label) : [];
        const participantAliases = topCounts(this.dailySenderCounts.get(d.date) ?? new Map<string, number>(), 3)
          .map((item) => aliases.get(item.label) ?? item.label);
        return buildDailyHotTopic({
          date: d.date,
          keywords: topKeywords,
          messageCount: d.count,
          avgDailyMessages,
          samples: this.dailyContextSamples.get(d.date) ?? [],
          participantAliases,
          isBurst: burstDateSet.has(d.date),
        });
      })
      .filter((d) => recentDateSet.has(d.date) || d.keywords.length > 0 || d.evidence.length > 0 || burstDateSet.has(d.date))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 14)
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── 최근 7일 + 리포트 당일 스냅샷 ──
    let recentSnapshot: RecentSnapshot | undefined;
    if (dailySorted.length > 0) {
      const lastDate = dailySorted[dailySorted.length - 1].date;
      const recentDays: DailySnapshot[] = [];
      const weekDateSet = new Set<string>();
      const weekSenderSet = new Set<string>();
      const weekKeywordCounts = new Map<string, number>();
      let weekTotal = 0;

      // 최근 7일 (lastDate 포함, 역순으로 7일)
      const [ly, lm, ld] = lastDate.split("-").map(Number);
      const lastUtcMs = Date.UTC(ly, lm - 1, ld);
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastUtcMs - (6 - i) * 86_400_000);
        const dateStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
        weekDateSet.add(dateStr);

        const dayCount = this.daily.get(dateStr) ?? 0;
        const senderMap = this.dailySenderCounts.get(dateStr);
        const topSenders = senderMap
          ? topCounts(senderMap, 3).map((item) => ({
            alias: aliases.get(item.label) ?? item.label,
            count: item.count,
          }))
          : [];
        if (senderMap) {
          for (const raw of senderMap.keys()) weekSenderSet.add(aliases.get(raw) ?? raw);
        }

        const bucket = this.dailyKeywordBuckets.get(dateStr);
        const keywords = bucket ? bucket.topCounts(4).map((item) => item.label) : [];
        for (const kw of keywords) weekKeywordCounts.set(kw, (weekKeywordCounts.get(kw) ?? 0) + 1);

        const sentCounters = this.dailySentimentCounters.get(dateStr) ?? { positive: 0, negative: 0, neutral: 0 };
        const totalSent = sentCounters.positive + sentCounters.negative + sentCounters.neutral;
        const sentiment = totalSent > 0
          ? {
            positive: round((sentCounters.positive / totalSent) * 100, 1),
            negative: round((sentCounters.negative / totalSent) * 100, 1),
            neutral: round(100 - round((sentCounters.positive / totalSent) * 100, 1) - round((sentCounters.negative / totalSent) * 100, 1), 1),
          }
          : { positive: 0, negative: 0, neutral: 100 };

        const hourly = this.dailyHourly.get(dateStr) ?? Array(24).fill(0) as number[];
        let peakHour: number | null = null;
        let peakCount = -1;
        for (let h = 0; h < 24; h++) {
          if ((hourly[h] ?? 0) > peakCount) { peakCount = hourly[h] ?? 0; peakHour = h; }
        }
        if (peakCount <= 0) peakHour = null;

        const vsAvg = avgDailyMessages > 0 ? round(dayCount / avgDailyMessages, 1) : 0;

        // 해당 일의 핫토픽 요약 (기존 dailyHotTopics에서 찾기)
        const hotTopic = dailyHotTopics.find((t) => t.date === dateStr);

        recentDays.push({
          date: dateStr,
          messageCount: dayCount,
          activeParticipants: senderMap?.size ?? 0,
          topSenders,
          keywords,
          sentiment,
          hourly: [...hourly],
          peakHour,
          vsAvg,
          hotTopicSummary: hotTopic?.summary,
          evidence: hotTopic?.evidence,
        });

        weekTotal += dayCount;
      }

      // 리포트 당일 — lastDate와 동일한 날짜의 데이터
      const todaySnapshot = recentDays.length > 0 ? recentDays[recentDays.length - 1] : null;
      // today가 week에 포함되어 있으므로 weekTotal은 이미 포함

      // 주간 상위 키워드
      const weekKeywords = [...weekKeywordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([kw]) => kw);

      const weekVsOverall = avgDailyMessages > 0 ? round((weekTotal / 7) / avgDailyMessages, 1) : 0;

      recentSnapshot = {
        lastDate,
        reportDay: lastDate,
        week: recentDays,
        today: todaySnapshot,
        weekTotal,
        weekVsOverall,
        weekParticipants: weekSenderSet.size,
        weekKeywords,
      };
    }

    const memorableMoments = extractMemorableMoments({
      daily: dailySorted,
      dailySentiment,
      totalMessages: total,
      firstMessageDate: this.firstDate ? formatDateTime(this.firstDate) : null,
      lastMessageDate: this.lastDate ? formatDateTime(this.lastDate) : null,
      dailyHotTopics,
    });

    const emojiInsight: import("./types.js").EmojiInsight = {
      totalEmojis: this.emojiMessages,
      breakdown: { ...this.emojiSentimentCounts },
      topEmojis: topCounts(this.topEmojis, 5).map((item) => ({ emoji: item.label, count: item.count })),
    };

    const participantEmojiStats: import("./types.js").ParticipantEmojiStat[] = [];
    for (const [rawSender, emojiMap] of this.senderEmojiCounts) {
      const alias = aliases.get(rawSender);
      if (!alias) continue;
      const totalEmojis = [...emojiMap.values()].reduce((a, b) => a + b, 0);
      const topEmojis = topCounts(emojiMap, 3).map((item) => ({ emoji: item.label, count: item.count }));
      // dominantEmotion: 가장 많이 나온 감정 카테고리
      const emotionCounts: Record<string, number> = {};
      for (const [emoji, count] of emojiMap) {
        const cat = classifyEmoji(emoji);
        emotionCounts[cat] = (emotionCounts[cat] || 0) + count;
      }
      let dominantEmotion = "neutral";
      let maxCount = -1;
      for (const [cat, count] of Object.entries(emotionCounts)) {
        if (count > maxCount) {
          maxCount = count;
          dominantEmotion = cat;
        }
      }
      participantEmojiStats.push({ alias, totalEmojis, topEmojis, dominantEmotion });
    }
    participantEmojiStats.sort((a, b) => b.totalEmojis - a.totalEmojis);

    // 존칭/반말 인사이트 및 관계 추론
    const participantHonorifics: import("./types.js").ParticipantHonorific[] = [];
    let roomHonorificCount = 0;
    let roomCasualCount = 0;
    for (const [rawSender, counts] of this.senderHonorificCounts) {
      const alias = aliases.get(rawSender);
      if (!alias) continue;
      const styledTotal = counts.honorific + counts.casual;
      const observedTotal = styledTotal + counts.neutral;
      const honorificRatio = styledTotal > 0 ? counts.honorific / styledTotal : 0;
      const casualRatio = styledTotal > 0 ? counts.casual / styledTotal : 0;
      const neutralRatio = observedTotal > 0 ? counts.neutral / observedTotal : 1;
      let dominantStyle = "mixed";
      if (styledTotal < 3) dominantStyle = "insufficient";
      else if (honorificRatio >= 0.7) dominantStyle = "honorific";
      else if (casualRatio >= 0.7) dominantStyle = "casual";
      participantHonorifics.push({
        alias,
        honorificRatio,
        casualRatio,
        neutralRatio,
        sampleCount: observedTotal,
        styledSampleCount: styledTotal,
        dominantStyle,
      });
      roomHonorificCount += counts.honorific;
      roomCasualCount += counts.casual;
    }
    participantHonorifics.sort((a, b) => (b.sampleCount ?? 0) - (a.sampleCount ?? 0) || b.honorificRatio - a.honorificRatio);

    let roomStyle: "formal" | "casual" | "mixed" = "mixed";
    const roomTotal = roomHonorificCount + roomCasualCount;
    if (roomTotal > 0) {
      const roomHonorificRatio = roomHonorificCount / roomTotal;
      const roomCasualRatio = roomCasualCount / roomTotal;
      if (roomHonorificRatio >= 0.7) roomStyle = "formal";
      else if (roomCasualRatio >= 0.7) roomStyle = "casual";
    }

    const honorificInsight: import("./types.js").HonorificInsight | undefined =
      participantHonorifics.length > 0
        ? { participants: participantHonorifics, roomStyle }
        : undefined;

    const roomRelationship = honorificInsight
      ? inferRoomRelationship(honorificInsight)
      : undefined;

    const dailyTopicTrend = buildDailyTopicTrend(this.dailyKeywordBuckets);
    const weeklyTopicTrend = buildWeeklyTopicTrend(this.dailyKeywordBuckets);
    const topicTrend = buildMonthlyTopicTrend(this.dailyKeywordBuckets);
    const spanDays = dailySorted.length >= 2
      ? Math.floor((dateKeyToUtcMs(dailySorted[dailySorted.length - 1].date) - dateKeyToUtcMs(dailySorted[0].date)) / 86_400_000) + 1
      : dailySorted.length;
    const smartTopicTrend = pickSmartTopicTrend({
      daily: dailyTopicTrend,
      weekly: weeklyTopicTrend,
      monthly: topicTrend,
      activeDays,
      spanDays,
    });

    // ── 응답 지연 지문 ──
    const replyLatency = this.buildReplyLatencyFingerprint(aliases);

    // ── 질문-응답 토폴로지 ──
    const questionAnswer = this.buildQuestionAnswerTopology(aliases);

    // ── 급증일 핵심 항체 ──
    const burstAnatomy = this.buildBurstAnatomy(burstDays, avgDailyMessages, aliases);

    return {
      generatedAt: new Date().toISOString(),
      privacy: this.privacy,
      source: {
        fileName: safeInputName(meta.filePath),
        chatRoomName: parseChatRoomNameFromExportPath(meta.filePath),
        encoding: meta.encoding,
        physicalLines: meta.physicalLines,
        warnings: meta.warningCount,
      },
      summary: {
        totalMessages: total,
        participants: aliases.size,
        activeDays,
        firstMessage: this.firstDate ? formatDateTime(this.firstDate) : null,
        lastMessage: this.lastDate ? formatDateTime(this.lastDate) : null,
        averageMessageLength: round(this.totalCharacters / Math.max(total, 1), 1),
        messagesWithLinks: this.messagesWithLinks,
        messagesWithAttachments: this.messagesWithAttachments,
        messagesPerActiveDay,
        longestActiveStreakDays: longestStreak,
        peakHour,
        busiestWeekdayLabel,
        medianReplyGapMinutes,
        nightSharePercent,
        emojiMessages: this.emojiMessages,
        usedSemanticKeywords: finalizeOpts?.usedSemanticKeywords === true,
        usedSentimentAnalysis: finalizeOpts?.usedSentimentAnalysis === true,
        usedToxicityAnalysis: finalizeOpts?.usedToxicityAnalysis === true,
      },
      insights,
      participants: participantStats,
      participantsByCharacters,
      profanity: this.profanityCounter.buildProfanityStats(total, aliases),
      sentiment: this.sentimentStats,
      toxicity: this.toxicityStats,
      daily: dailySorted,
      hourly: this.hourly,
      weekdays: this.weekdays.map((count, index) => ({
        label: `${WEEKDAY_LABELS_KO[index] ?? index}요일`,
        count,
      })),
      monthly: [...this.monthly.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      attachments: topCounts(this.attachments, this.top),
      domains: topCounts(this.domains, this.top),
      keywords,
      keywordsDistinctive,
      topics,
      roomEvents: buildRoomEventStats(
        total,
        {
          join: this.roomJoinMessages,
          leave: this.roomLeaveMessages,
          deleted: this.roomDeletedMessages,
          hidden: this.roomHiddenMessages,
          kick: this.roomKickMessages,
          slowModeOn: this.roomSlowOnMessages,
          slowModeOff: this.roomSlowOffMessages,
          subManager: this.roomSubManagerMessages,
          manager: this.roomManagerMessages,
          shopSearch: this.roomShopSearchMessages,
          photoBundle: this.roomPhotoBundleMessages,
        },
        {
          tagExtractions: [...this.shopSearchTopics.values()].reduce((a, n) => a + n, 0),
          uniqueTags: this.shopSearchTopics.size,
          untaggedNotices: this.shopSearchUntaggedNotices,
        },
      ),
      repeatedPhrases: this.repeatPhraseCounter.top(8, 3),
      shopSearchTopics: topCounts(this.shopSearchTopics, shopSearchDisplayTop()),
      shopSearchMissSamples:
        process.env.KCA_DEBUG_SHOP === "1" ? [...this.shopSearchMissSamples] : undefined,
      pureLaughMessages: this.pureLaughMessages,
      conversationPace,
      burstDays,
      activityArc,
      roomPulse,
      highlights,
      story,
      interaction,
      timeline,
      narrative: narrativeFinal,
      periodCompare,
      benchmarks,
      explorer,
      openChatBoilerplateExcluded: this.openChatBoilerplateExcluded,
      burstDetectionMethod,
      dailyHotTopics,
      topicTrend,
      weeklyTopicTrend,
      smartTopicTrend,
      dailySentiment,
      participantRoles,
      emojiInsight,
      participantEmojiStats,
      honorificInsight,
      roomRelationship,
      memorableMoments,
      recentSnapshot,
      replyLatency,
      questionAnswer,
      burstAnatomy,
    };
  }

  private buildReplyLatencyFingerprint(aliases: Map<string, string>): import("./types.js").ReplyLatencyFingerprint | null {
    const allLatencies: number[] = [];
    const responders: import("./types.js").ResponderLatency[] = [];
    for (const [rawSender, latencies] of this.replyLatencyByResponder) {
      const alias = aliases.get(rawSender);
      if (!alias || latencies.length === 0) continue;
      const sorted = [...latencies].sort((a, b) => a - b);
      const median = medianSorted(sorted);
      const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1] ?? 0;
      const fast = latencies.filter((x) => x < 1).length;
      responders.push({
        alias,
        medianMinutes: round(median, 1),
        p90Minutes: round(p90, 1),
        replies: latencies.length,
        fastRatePercent: round((fast / latencies.length) * 100, 1),
      });
      allLatencies.push(...latencies);
    }
    if (allLatencies.length === 0) return null;
    const sortedAll = [...allLatencies].sort((a, b) => a - b);
    const totalFast = allLatencies.filter((x) => x < 1).length;
    const totalNormal = allLatencies.filter((x) => x >= 1 && x <= 10).length;
    const totalSlow = allLatencies.filter((x) => x > 10).length;
    return {
      roomMedianMinutes: round(medianSorted(sortedAll), 1),
      roomP90Minutes: round(sortedAll[Math.floor(sortedAll.length * 0.9)] ?? sortedAll[sortedAll.length - 1] ?? 0, 1),
      totalReplies: allLatencies.length,
      fastRatePercent: round((totalFast / allLatencies.length) * 100, 1),
      normalRatePercent: round((totalNormal / allLatencies.length) * 100, 1),
      slowRatePercent: round((totalSlow / allLatencies.length) * 100, 1),
      responders: responders.sort((a, b) => a.medianMinutes - b.medianMinutes),
    };
  }

  private buildQuestionAnswerTopology(aliases: Map<string, string>): import("./types.js").QuestionAnswerTopology | null {
    const totalQuestions = this.questionMessages;
    if (totalQuestions === 0) return null;
    const answered = this.pendingQuestions.filter((q) => q.answered).length + [...this.questionAnswerPairs.values()].reduce((s, p) => s + p.questions, 0);
    // pendingQuestions는 이미 questionAnswerPairs에 반영됨 → 실제 답변은 pairs 기준
    const actualAnswered = [...this.questionAnswerPairs.values()].reduce((s, p) => s + p.questions, 0);
    const allLatencies: number[] = [];
    for (const pair of this.questionAnswerPairs.values()) allLatencies.push(...pair.latencies);
    const sortedLatencies = [...allLatencies].sort((a, b) => a - b);
    const topPairs: import("./types.js").QuestionAnswerPair[] = [];
    for (const [key, pair] of this.questionAnswerPairs) {
      const [askerRaw, answererRaw] = key.split("\u0001");
      const asker = aliases.get(askerRaw ?? "");
      const answerer = aliases.get(answererRaw ?? "");
      if (!asker || !answerer) continue;
      const sorted = [...pair.latencies].sort((a, b) => a - b);
      topPairs.push({
        asker,
        answerer,
        questions: pair.questions,
        medianAnswerMinutes: round(medianSorted(sorted), 1),
      });
    }
    topPairs.sort((a, b) => b.questions - a.questions);
    const topAnswerers = [...this.answererCounts.entries()]
      .map(([raw, answers]) => ({ alias: aliases.get(raw) ?? raw, answers }))
      .filter((x) => x.alias)
      .sort((a, b) => b.answers - a.answers);
    return {
      totalQuestions,
      answeredQuestions: actualAnswered,
      answerRatePercent: round((actualAnswered / Math.max(totalQuestions, 1)) * 100, 1),
      medianAnswerMinutes: round(medianSorted(sortedLatencies), 1),
      topAnswerers: topAnswerers.slice(0, 5),
      topPairs: topPairs.slice(0, 6),
    };
  }

  private buildBurstAnatomy(
    burstDays: DailyCount[],
    avgDailyMessages: number,
    aliases: Map<string, string>,
  ): import("./types.js").BurstAnatomy[] {
    return burstDays.slice(0, 5).map((d) => {
      const senderMap = this.dailySenderCounts.get(d.date) ?? new Map<string, number>();
      const participants = topCounts(senderMap, 4).map((item) => aliases.get(item.label) ?? item.label);
      const bucket = this.dailyKeywordBuckets.get(d.date);
      const topKeywords = bucket ? bucket.topCounts(4).map((item) => item.label) : [];
      const vsAverage = avgDailyMessages > 0 ? round(d.count / avgDailyMessages, 2) : 1;
      return {
        date: d.date,
        messages: d.count,
        participants,
        topKeywords,
        durationHours: null,
        vsAverage,
      };
    });
  }
}

