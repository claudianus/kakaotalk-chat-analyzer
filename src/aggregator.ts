import { formatDate, formatDateTime, partsToUtcMs, weekdayIndex } from "./date.js";
import type {
  ChatRecord,
  CountItem,
  EncodingName,
  ParticipantStat,
  ParsedDateParts,
  PrivacyMode,
  ReportData,
  ReportInsights,
  SentimentStats,
  ToxicityStats,
} from "./types.js";
import { maskPartialDisplayName, parseChatRoomNameFromExportPath, safeInputName } from "./analysis-labels.js";
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
import { formatCompactNumber, formatReplyGapMinutes } from "./report-util.js";
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
import type { ExplorerPayload, ParticipantRole } from "./types.js";

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
const PHOTO_BUNDLE_RE = /^사진\s+\d+\s*장$/;
const PURE_LAUGH_RE = /^[ㅋㅎㅠㅜ]+$/u;
const PLAN_SIGNAL_RE =
  /(?:\d{1,2}\s*월|\d{1,2}\s*일|내일|모레|다음\s*주|오전|오후|저녁|점심|몇\s*시|\d{1,2}:\d{2})/u;
const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4, 5]);
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const LAUGH_RE = /(?:ㅋ{2,}|ㅎ{2,}|ㅠ+|ㅜ+|ㅇㅇ|ㅋㅋ|ㅎㅎ|ㅋㅎ|ㅎㅋ)/;
const LINK_HINT_RE = /https?:\/\/|www\./i;
const HAS_TOKEN_CHAR_RE = /[가-힣A-Za-z]/;

/** 규칙 기반 감정 키워드 — 긍정/부정/중립 분류 */
const POSITIVE_PATTERNS = [
  /(?:\b|[^가-힣A-Za-z])(ㅋㅋ|ㅎㅎ|ㅋㅎ|ㅎㅋ)(?:\b|[^가-힣A-Za-z])/u,
  /(?:좋아요|고마워|감사|축하|대박|신나|기쁘|행복|재미|재밌|웃겨|웃기|ㅇㅋ|ㅇㅇ|넵|예|굿|좋|최고|멋|잘했|잘하|사랑|귀엽|예쁘|잘생|대단|훌륭|완벽|만세|ㅊㅋ|파이팅|화이팅|감동|행복|신난다|대단|베스트|예쁘다|멋지|잘한다|고마워|ㅋㅋㅋ|ㅎㅎㅎ)/u,
];
const NEGATIVE_PATTERNS = [
  /(?:싫어|짜증|화나|분노|슬퍼|우울|걱정|불안|화가|엽나|빡|ㅅㅂ|ㅆㅂ|졌나|씨발|시발|지랄|미친|병신|개같|극혐|싫|나쁘|별로|안돼|큰일|문제|실패|어렵|힘들|짜증|귀찮|쓸데없|헛소리|비아냥|까|디스|따져|몰라|관심없|지겹|답답|후회|실망|분통|개빡|열|지치|괴롭|울고|눈물|죽겠|죽음)/u,
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
  private readonly dyads = new DyadAccumulator();
  private readonly dailySentimentCounters = new Map<string, { positive: number; negative: number; neutral: number }>();
  private readonly senderHonorificCounts = new Map<string, { honorific: number; casual: number; neutral: number }>();

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

  applyKeywordTokens(kwTokens: string[], monthKey: string): void {
    this.keywordStream.addDocumentTokens(kwTokens);
    this.topicMap.addMessage(kwTokens, monthKey);
    let monthBucket = this.monthlyKeywordBuckets.get(monthKey);
    if (!monthBucket) {
      monthBucket = new KeywordCounter();
      this.monthlyKeywordBuckets.set(monthKey, monthBucket);
    }
    for (const t of kwTokens) monthBucket.add(t);
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
    this.applyKeywordTokens(row.tokens, row.monthKey);
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

  consume(
    record: ChatRecord,
    opts?: { keywordsOnly?: boolean; skipKeywords?: boolean; collectSamples?: boolean },
  ): void {
    if (opts?.keywordsOnly) {
      this.consumeKeywords(record);
      return;
    }
    if (this.prevSender !== null && record.sender !== this.prevSender) {
      this.speakerSwitches += 1;
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
      if (messageLength > 0 && EMOJI_RE.test(msg)) {
        this.emojiMessages += 1;
        const emojis = extractEmojis(msg);
        for (const emoji of emojis) {
          const cat = classifyEmoji(emoji);
          this.emojiSentimentCounts[cat as keyof typeof this.emojiSentimentCounts]++;
          this.topEmojis.set(emoji, (this.topEmojis.get(emoji) || 0) + 1);
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
      }
      this.sessionGapStats.addMessage(ms);
      this.prevMs = ms;

      if (this.prevSender !== null && record.sender !== this.prevSender) {
        this.dyads.addReply(this.prevSender, record.sender);
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
        this.applyKeywordTokens(kwTokens, `${record.date.year}-${pad2(record.date.month)}`);
        let dayBucket = this.dailyKeywordBuckets.get(dayKey);
        if (!dayBucket) {
          dayBucket = new KeywordCounter();
          this.dailyKeywordBuckets.set(dayKey, dayBucket);
        }
        for (const t of kwTokens) dayBucket.add(t);
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

    const dailyHotTopics: import("./types.js").DailyHotTopic[] = dailySorted
      .map((d) => {
        const bucket = this.dailyKeywordBuckets.get(d.date);
        const topKeywords = bucket ? bucket.topCounts(3).map((item) => item.label) : [];
        const summary =
          topKeywords.length > 0
            ? `${topKeywords.join("·")} 언급이 많았어요`
            : "활발한 대화가 이어졌어요";
        return {
          date: d.date,
          keywords: topKeywords,
          summary,
          messageCount: d.count,
        };
      })
      .filter((d) => d.keywords.length > 0 || d.messageCount > 0);

    const memorableMoments = extractMemorableMoments({
      daily: dailySorted,
      dailySentiment,
      totalMessages: total,
      firstMessageDate: this.firstDate ? formatDateTime(this.firstDate) : null,
      lastMessageDate: this.lastDate ? formatDateTime(this.lastDate) : null,
    });

    const emojiInsight: import("./types.js").EmojiInsight = {
      totalEmojis: this.emojiMessages,
      breakdown: { ...this.emojiSentimentCounts },
      topEmojis: topCounts(this.topEmojis, 5).map((item) => ({ emoji: item.label, count: item.count })),
    };

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
      topicTrend: [],
      dailySentiment,
      participantRoles,
      emojiInsight,
      memorableMoments,
    };
  }
}

function splitMonthlyKeywordBuckets(
  buckets: Map<string, KeywordCounter>,
): { headKeywords: CountItem[]; tailKeywords: CountItem[] } {
  const months = [...buckets.keys()].sort();
  if (months.length < 2) {
    return { headKeywords: [], tailKeywords: [] };
  }
  const mid = Math.floor(months.length / 2);
  const mergeMonths = (keys: string[]) => {
    const acc = new KeywordCounter();
    for (const k of keys) {
      const b = buckets.get(k);
      if (!b) continue;
      for (const item of b.topCounts(40)) acc.addHits(item.label, item.count);
    }
    return acc.topCounts(12);
  };
  return {
    headKeywords: mergeMonths(months.slice(0, mid)),
    tailKeywords: mergeMonths(months.slice(mid)),
  };
}

function topDailyLinkSpikes(
  dailyLinks: Map<string, number>,
): { date: string; links: number }[] {
  return [...dailyLinks.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([date, links]) => ({ date, links }));
}

function buildSenderLabels(senders: string[], privacy: PrivacyMode): Map<string, string> {
  const unique = [...new Set(senders)];
  if (privacy === "public-anonymous") {
    const map = new Map<string, string>();
    unique.forEach((sender, i) => map.set(sender, `User ${String(i + 1).padStart(3, "0")}`));
    return map;
  }

  const map = new Map<string, string>();
  const used = new Map<string, number>();
  for (const raw of unique) {
    let base = maskPartialDisplayName(raw);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    if (n > 1) base = `${base}·${n}`;
    map.set(raw, base);
  }
  return map;
}

function getParticipantStat(stats: Map<string, MutableParticipantStat>, sender: string): MutableParticipantStat {
  const existing = stats.get(sender);
  if (existing) return existing;
  const created: MutableParticipantStat = {
    messages: 0,
    characters: 0,
    attachmentMessages: 0,
    linkMessages: 0,
    nightMessages: 0,
    maxConsecutive: 0,
  };
  stats.set(sender, created);
  return created;
}

function buildRoomEventStats(
  total: number,
  c: {
    join: number;
    leave: number;
    deleted: number;
    hidden: number;
    kick: number;
    slowModeOn: number;
    slowModeOff: number;
    subManager: number;
    manager: number;
    shopSearch: number;
    photoBundle: number;
  },
  shopExtra?: { tagExtractions: number; uniqueTags: number; untaggedNotices: number },
): import("./types.js").RoomEventStats {
  const sum =
    c.join +
    c.leave +
    c.deleted +
    c.hidden +
    c.kick +
    c.slowModeOn +
    c.slowModeOff +
    c.subManager +
    c.manager +
    c.shopSearch +
    c.photoBundle;
  const pct = (n: number) => (total > 0 ? round((n / total) * 100, 2) : 0);
  return {
    joinCount: c.join,
    leaveCount: c.leave,
    deletedCount: c.deleted,
    hiddenCount: c.hidden,
    kickCount: c.kick,
    slowModeOnCount: c.slowModeOn,
    slowModeOffCount: c.slowModeOff,
    subManagerCount: c.subManager,
    managerCount: c.manager,
    shopSearchCount: c.shopSearch,
    shopSearchTagExtractions: shopExtra?.tagExtractions ?? 0,
    shopSearchUniqueTags: shopExtra?.uniqueTags ?? 0,
    shopSearchUntaggedNotices: shopExtra?.untaggedNotices ?? 0,
    photoBundleCount: c.photoBundle,
    total: sum,
    joinSharePercent: pct(c.join),
    leaveSharePercent: pct(c.leave),
    deletedSharePercent: pct(c.deleted),
    hiddenSharePercent: pct(c.hidden),
    kickSharePercent: pct(c.kick),
  };
}

function getDomains(message: string): string[] {
  const matches = message.match(URL_RE) ?? [];
  const domains: string[] = [];
  for (const match of matches) {
    const urlText = match.startsWith("http") ? match : `https://${match}`;
    try {
      const url = new URL(urlText);
      domains.push(url.hostname.toLowerCase().replace(/^www\./, ""));
    } catch {
      continue;
    }
  }
  return domains;
}

function normalizeToken(token: string): string {
  return /^[A-Za-z0-9_+-]+$/.test(token) ? token.toLowerCase() : token.trim();
}

function top1ShareFromCounts(keywords: { count: number }[], totalMessages: number): number | null {
  if (keywords.length === 0 || totalMessages === 0) return null;
  const sum = keywords.reduce((a, k) => a + k.count, 0);
  if (sum === 0) return null;
  return round((keywords[0]!.count / sum) * 100, 1);
}

function typeRichnessFromKeywords(
  keywords: { label: string; count: number }[],
  totalMessages: number,
): number | null {
  if (totalMessages === 0 || keywords.length === 0) return null;
  const tokenSum = keywords.reduce((a, k) => a + k.count, 0);
  if (tokenSum === 0) return null;
  return round((keywords.length / tokenSum) * 100, 1);
}

function increment(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function topCounts(map: Map<string, number>, limit: number): CountItem[] {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function medianSorted(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function longestDateStreak(sortedYmd: string[]): number {
  if (sortedYmd.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sortedYmd.length; i += 1) {
    const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
    const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
    const diffDays = Math.round((b - a) / 86_400_000);
    if (diffDays === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

function computeGini(counts: number[]): number | null {
  if (counts.length === 0) return null;
  const sorted = [...counts].sort((a, b) => a - b);
  const n = sorted.length;
  let sum = 0;
  for (const x of sorted) sum += x;
  if (sum === 0) return null;
  let num = 0;
  for (let i = 0; i < n; i += 1) {
    num += (2 * i - n + 1) * sorted[i]!;
  }
  return round(num / (n * sum), 3);
}

function maxSilenceGapDays(sortedYmd: string[]): number | null {
  if (sortedYmd.length < 2) return null;
  let best = 0;
  for (let i = 1; i < sortedYmd.length; i += 1) {
    const a = new Date(`${sortedYmd[i - 1]}T12:00:00Z`).getTime();
    const b = new Date(`${sortedYmd[i]}T12:00:00Z`).getTime();
    const diffDays = Math.round((b - a) / 86_400_000);
    best = Math.max(best, Math.max(0, diffDays - 1));
  }
  return best;
}

function computeTop3Share(stats: Map<string, MutableParticipantStat>, total: number): number {
  if (total === 0) return 0;
  const top3 = [...stats.values()]
    .map((s) => s.messages)
    .sort((a, b) => b - a)
    .slice(0, 3)
    .reduce((a, c) => a + c, 0);
  return round((top3 / total) * 100, 1);
}

function domainEntropyBits(domains: Map<string, number>): number | null {
  let sum = 0;
  for (const c of domains.values()) sum += c;
  if (sum === 0) return null;
  let h = 0;
  for (const c of domains.values()) {
    if (c <= 0) continue;
    const p = c / sum;
    h -= p * Math.log2(p);
  }
  return round(h, 2);
}

function computeDensityFromSpan(
  first: ParsedDateParts | null,
  last: ParsedDateParts | null,
  total: number,
): number | null {
  if (total === 0 || !first || !last) return null;
  const spanDays = Math.max(1, Math.floor((partsToUtcMs(last) - partsToUtcMs(first)) / 86_400_000) + 1);
  return round(total / spanDays, 2);
}

function computeDaypartPercents(
  hourly: number[],
  total: number,
): { key: string; label: string; percent: number }[] {
  const bands = [
    { key: "dawn", label: "새벽(0~5시)", lo: 0, hi: 5 },
    { key: "morning", label: "오전(6~11시)", lo: 6, hi: 11 },
    { key: "afternoon", label: "오후(12~17시)", lo: 12, hi: 17 },
    { key: "evening", label: "저녁(18~23시)", lo: 18, hi: 23 },
  ] as const;
  if (total === 0) {
    return bands.map((b) => ({ key: b.key, label: b.label, percent: 0 }));
  }
  const raw = bands.map((b) => {
    let c = 0;
    for (let h = b.lo; h <= b.hi; h += 1) c += hourly[h] ?? 0;
    return { key: b.key, label: b.label, count: c };
  });
  const sum = raw.reduce((a, x) => a + x.count, 0) || 1;
  let rounded = raw.map((x) => ({
    key: x.key,
    label: x.label,
    percent: round((x.count / sum) * 100, 1),
  }));
  const drift = 100 - rounded.reduce((a, x) => a + x.percent, 0);
  if (Math.abs(drift) >= 0.05 && rounded.length > 0) {
    const idx = rounded.reduce((best, x, i, arr) => (x.percent >= arr[best]!.percent ? i : best), 0);
    rounded = rounded.map((x, i) => (i === idx ? { ...x, percent: round(x.percent + drift, 1) } : x));
  }
  return rounded;
}

function buildParticipantRoles(
  participants: ParticipantStat[],
  laughBySender: Map<string, number>,
  shortBySender: Map<string, number>,
  aliases: Map<string, string>,
): ParticipantRole[] {
  if (participants.length === 0) return [];

  const sortedByMessages = [...participants].sort((a, b) => b.messages - a.messages);
  const totalMessages = participants.reduce((sum, p) => sum + p.messages, 0);
  const avgLengthOverall =
    participants.reduce((sum, p) => sum + p.averageLength, 0) / participants.length;

  const top25Threshold = Math.ceil(participants.length * 0.25);
  const top50Threshold = Math.ceil(participants.length * 0.5);

  const results: ParticipantRole[] = [];

  for (const p of participants) {
    const rawAlias = [...aliases.entries()].find(([, a]) => a === p.alias)?.[0];
    const laughCount = rawAlias ? (laughBySender.get(rawAlias) ?? 0) : 0;
    const shortCount = rawAlias ? (shortBySender.get(rawAlias) ?? 0) : 0;
    const laughRate = p.messages > 0 ? (laughCount / p.messages) : 0;
    const shortRate = p.messages > 0 ? (shortCount / p.messages) : 0;

    const rankByMessages = sortedByMessages.findIndex((x) => x.alias === p.alias);
    const isTop25 = rankByMessages < top25Threshold;
    const isBottom50 = rankByMessages >= top50Threshold;
    const isLong = p.averageLength >= avgLengthOverall * 1.2;
    const isShort = p.averageLength <= avgLengthOverall * 0.7;
    const isVeryLong = p.averageLength >= avgLengthOverall * 1.5;

    let role: string;
    let confidence: number;
    let reason: string;

    if (isTop25 && isLong) {
      role = "리더";
      confidence = 0.9;
      reason = `메시지 수 상위(${p.messages}건)에 평균 길이(${p.averageLength}자)가 전체 평균(${avgLengthOverall.toFixed(1)}자)보다 긴 주도형 참여자`;
    } else if (laughRate > 0.15 || (isBottom50 && shortRate > 0.3)) {
      role = "유머메이커";
      confidence = 0.8;
      reason = `웃음 표현 비율(${Math.round(laughRate * 100)}%)이 높거나 짧은 반응 메시지가 많은 분위기 메이커`;
    } else if (isBottom50 && isVeryLong) {
      role = "조용한기여자";
      confidence = 0.85;
      reason = `메시지 수는 적지만 평균 길이(${p.averageLength}자)가 전체 평균(${avgLengthOverall.toFixed(1)}자)의 1.5배 이상인 깊이 있는 기여자`;
    } else if (isBottom50 && isShort) {
      role = "방관자";
      confidence = 0.8;
      reason = `메시지 수가 적고 짧은 메시지(${p.averageLength}자) 위주로 주로 관찰하는 참여자`;
    } else {
      role = "조력자";
      confidence = 0.75;
      reason = `균형 잡힌 메시지 수(${p.messages}건)와 길이(${p.averageLength}자)로 대화를 돕는 조력자`;
    }

    results.push({ alias: p.alias, role, confidence, reason });
  }

  return results;
}

function computeRhythmScore(input: {
  gini: number | null;
  longestStreak: number;
  density: number | null;
}): number {
  const g = input.gini ?? 0.45;
  const streakN = Math.min(1, input.longestStreak / 28);
  const densityN = input.density != null ? Math.min(1, input.density / 40) : 0.25;
  const score = 48 * (1 - Math.min(0.95, g)) + 32 * streakN + 20 * densityN;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildHighlights(input: {
  total: number;
  topAlias: string | null;
  topShare: number | null;
  busiestWeekdayLabel: string | null;
  peakHour: number | null;
  medianReplyGapMinutes: number | null;
  nightSharePercent: number;
  longestStreak: number;
  emojiMessages: number;
  messagesWithAttachments: number;
  weekendSharePercent: number;
  participantGini: number | null;
  replyGapP90Minutes: number | null;
  maxSilenceBetweenActiveDays: number | null;
  rhythmScore: number;
  burstGapUnder1mPercent: number | null;
  monologueMessagesPercent: number;
  roomJoinMessages: number;
  roomLeaveMessages: number;
  roomDeletedMessages: number;
  roomHiddenMessages: number;
  roomKickMessages: number;
  pureLaughMessages: number;
  repeatedPhraseCount: number;
  burstDays: { date: string; count: number }[];
  activityArc: { id: string; label: string; messages: number; activeDays: number }[];
  conversationPace: { label: string; emoji: string; detail: string };
  roomPulse: { date: string; join: number; leave: number; hidden: number; kick: number; newSenders: number }[];
  lexicalTypeRichnessPercent: number | null;
  speakerSwitchRatePer100: number;
}): string[] {
  const out: string[] = [];
  if (input.topAlias && input.topShare !== null && input.total > 0) {
    out.push(`가장 말이 많았던 분은 **${input.topAlias}** (전체의 **${input.topShare}%**).`);
  }
  if (input.busiestWeekdayLabel) {
    out.push(`요일별로는 **${input.busiestWeekdayLabel}**에 활동이 가장 활발했어요.`);
  }
  if (input.peakHour !== null) {
    out.push(`시간대는 **${input.peakHour}시**대에 메시지가 가장 몰렸습니다.`);
  }
  if (input.medianReplyGapMinutes !== null) {
    out.push(`연속 메시지 사이 간격의 중앙값은 **${formatReplyGapMinutes(input.medianReplyGapMinutes)}** 정도예요.`);
  }
  if (input.nightSharePercent > 0) {
    out.push(`심야(23~05시) 메시지 비중은 **${input.nightSharePercent}%**입니다.`);
  }
  if (input.longestStreak > 1) {
    out.push(`하루도 빠짐없이 이어진 최장 **${input.longestStreak}일** 연속 활동 기록이 있어요.`);
  }
  if (input.emojiMessages > 0) {
    out.push(`이모지·스티커 느낌의 메시지는 **${input.emojiMessages}**건 정도 감지됐어요.`);
  }
  if (input.messagesWithAttachments > 0) {
    out.push(`사진·파일·동영상 등 첨부가 들어간 메시지는 **${input.messagesWithAttachments}**건입니다.`);
  }
  if (input.total > 0 && input.weekendSharePercent > 0) {
    out.push(`주말(토·일) 메시지 비중은 **${input.weekendSharePercent}%**예요.`);
  }
  if (input.participantGini !== null && input.participantGini >= 0.35) {
    out.push(`참여도는 소수에게 조금 몰린 편이에요(지니 **${input.participantGini}** — 1에 가까울수록 쏠림).`);
  }
  if (input.replyGapP90Minutes !== null && input.replyGapP90Minutes >= 30) {
    out.push(`가끔 긴 침묵도 있어요 — 응답 간격 **상위 10%**가 약 **${input.replyGapP90Minutes}분** 이상입니다.`);
  }
  if (input.maxSilenceBetweenActiveDays !== null && input.maxSilenceBetweenActiveDays >= 7) {
    out.push(`활동일 사이 최대 **${input.maxSilenceBetweenActiveDays}일** 동안은 메시지가 끊긴 구간이 있었어요.`);
  }
  if (input.rhythmScore >= 65) {
    out.push(`종합 **리듬 점수**는 **${input.rhythmScore}/100** — 꾸준하고 균형 잡힌 페이스에 가깝습니다.`);
  }
  if (input.burstGapUnder1mPercent !== null && input.burstGapUnder1mPercent >= 40) {
    out.push(`응답 간격의 **${input.burstGapUnder1mPercent}%**가 1분 이내로, 실시간 대화 톤이 강해요.`);
  }
  if (input.monologueMessagesPercent >= 25) {
    out.push(`같은 사람 **3연속 이상** 메시지가 전체의 **${input.monologueMessagesPercent}%** — 긴 설명·정리 구간이 잦을 수 있어요.`);
  }
  const sysTotal =
    input.roomJoinMessages +
    input.roomLeaveMessages +
    input.roomDeletedMessages +
    input.roomHiddenMessages +
    input.roomKickMessages;
  if (sysTotal > 0) {
    const parts = [
      input.roomJoinMessages > 0 ? `들어옴 ${input.roomJoinMessages}` : "",
      input.roomLeaveMessages > 0 ? `나감 ${input.roomLeaveMessages}` : "",
      input.roomDeletedMessages > 0 ? `삭제 ${input.roomDeletedMessages}` : "",
      input.roomHiddenMessages > 0 ? `가림 ${input.roomHiddenMessages}` : "",
      input.roomKickMessages > 0 ? `강퇴 ${input.roomKickMessages}` : "",
    ].filter(Boolean);
    out.push(
      `카카오톡 **시스템·운영 알림** **${sysTotal}**건(${parts.join(" · ")}) — 본문 키워드와 분리했어요.`,
    );
  }
  if (input.pureLaughMessages > 0) {
    out.push(`**ㅋㅋ만** 보낸 리액션 메시지는 **${input.pureLaughMessages}**건이에요.`);
  }
  if (input.repeatedPhraseCount >= 10) {
    out.push(`똑같은 문장이 **${input.repeatedPhraseCount}회** 반복된 복붙·환영 문구도 있어요.`);
  }
  if (input.burstDays.length > 0) {
    const top = input.burstDays[0]!;
    const labels = input.burstDays
      .slice(0, 3)
      .map((d) => formatDayMdHighlight(d.date))
      .join(" · ");
    out.push(
      `메시지가 평소보다 몰린 날 **${input.burstDays.length}일** — 최고는 **${formatDayMdHighlight(top.date)}**(${formatCompactNumber(top.count)}건). ${labels}`,
    );
  }
  const head = input.activityArc.find((a) => a.id === "head");
  const tail = input.activityArc.find((a) => a.id === "tail");
  if (head && tail && head.messages > 0 && tail.messages > 0) {
    const ratio = round(tail.messages / head.messages, 2);
    if (ratio >= 1.25) {
      out.push(`마지막 7일이 처음 7일보다 **${ratio}배** 활발 — 대화가 뜨거워지는 구간이 있었어요.`);
    } else if (ratio <= 0.8) {
      out.push(`처음 7일이 마지막보다 더 붐볐어요(후반은 처음의 **${Math.round(ratio * 100)}%** 수준).`);
    }
  }
  if (input.lexicalTypeRichnessPercent !== null && input.lexicalTypeRichnessPercent >= 18) {
    out.push(`본문 단어는 **${input.lexicalTypeRichnessPercent}%** 정도로 서로 다른 표현이 많이 섞였어요.`);
  }
  const pace = input.conversationPace;
  out.push(`대화 템포는 **${pace.emoji} ${pace.label}** — ${pace.detail}`);
  const peakHidden = [...input.roomPulse].sort((a, b) => b.hidden - a.hidden)[0];
  if (peakHidden && peakHidden.hidden >= 5) {
    out.push(
      `가림 알림이 가장 많았던 날은 **${formatDayMdHighlight(peakHidden.date)}**(${peakHidden.hidden}건)이에요.`,
    );
  }
  const peakJoin = [...input.roomPulse].sort((a, b) => b.join - a.join)[0];
  if (peakJoin && peakJoin.join >= 20) {
    out.push(`입장이 가장 몰린 날은 **${formatDayMdHighlight(peakJoin.date)}** — **${peakJoin.join}**명 들어왔어요.`);
  }
  return out.slice(0, 14);
}

function formatDayMdHighlight(ymd: string): string {
  const p = ymd.split("-");
  if (p.length === 3) return `${Number(p[1])}/${Number(p[2])}`;
  return ymd;
}

