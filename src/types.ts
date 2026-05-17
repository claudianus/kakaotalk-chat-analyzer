export type EncodingName = "utf-8-bom" | "utf-8" | "cp949" | "euc-kr";

export type PrivacyMode = "public-masked" | "public-anonymous";

export interface ParsedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface ChatRecord {
  line: number;
  rawDate: string;
  date: ParsedDateParts;
  sender: string;
  message: string;
}

export interface ParseWarning {
  line: number;
  code: string;
  message: string;
}

export interface ParseResult {
  filePath: string;
  encoding: EncodingName;
  physicalLines: number;
  records: ChatRecord[];
  warnings: ParseWarning[];
  header: string[];
}

export interface ParticipantStat {
  alias: string;
  messages: number;
  characters: number;
  averageLength: number;
  attachmentMessages: number;
  linkMessages: number;
  /** 전체 메시지 대비 비율(%) */
  sharePercent: number;
  /** 전체 글자 수 대비 비율(%) */
  characterSharePercent: number;
  /** 23~05시(심야) 메시지 수 */
  nightMessages: number;
  /** 동일 발신자 연속 메시지 최대 길이 */
  maxConsecutive: number;
}

export interface CountItem {
  label: string;
  count: number;
  /** BM25 레인 내 순위(1=최상위 특이어) — dual-lane 병합 시 */
  distinctiveRank?: number;
  /** freq·bm25·both — 툴팁용 */
  keywordLane?: "freq" | "bm25" | "both";
}

export interface ProfanityStats {
  totalHits: number;
  messagesWithProfanity: number;
  per100Messages: number;
  topBySender: { alias: string; hits: number; messages: number }[];
}

export interface SentimentStats {
  sampleSize: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
  compoundScore: number;
  bySender: {
    alias: string;
    positivePercent: number;
    negativePercent: number;
    sampleMessages: number;
  }[];
}

/** c-TF-IDF·공기 군집으로 뽑은 대화 주제 */
export interface ReportTopic {
  id: string;
  kind: "theme" | "period";
  title: string;
  terms: string[];
  /** 해당 주제 신호가 잡힌 메시지 비율(%) — 근사치 */
  messagePercent: number;
  periodLabel?: string;
}

/** 카카오톡 시스템·운영 알림 집계 */
export interface RoomEventStats {
  joinCount: number;
  leaveCount: number;
  deletedCount: number;
  hiddenCount: number;
  kickCount: number;
  slowModeOnCount: number;
  slowModeOffCount: number;
  subManagerCount: number;
  managerCount: number;
  shopSearchCount: number;
  /** 샵검색 알림 중 #태그 추출에 성공한 횟수(태그별 합) */
  shopSearchTagExtractions: number;
  /** 고유 #태그 수 */
  shopSearchUniqueTags: number;
  /** 알림은 있으나 태그 미추출 */
  shopSearchUntaggedNotices: number;
  photoBundleCount: number;
  total: number;
  joinSharePercent: number;
  leaveSharePercent: number;
  deletedSharePercent: number;
  hiddenSharePercent: number;
  kickSharePercent: number;
}

/** 동일 문구 반복(복붙·환영문 등) */
export interface RepeatedPhraseStat {
  label: string;
  count: number;
  /** 해당 문구가 가장 많이 반복된 날 (YYYY-MM-DD) */
  peakDate?: string;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface WrappedCard {
  id: string;
  emoji: string;
  title: string;
  stat: string;
  sub: string;
}

export interface ParticipantPersona {
  alias: string;
  title: string;
  reason: string;
}

export interface StoryChapter {
  index: number;
  label: string;
  fromDate: string;
  toDate: string;
  activeDays: number;
  messages: number;
  shareOfAll: number;
  topAlias: string | null;
  topSharePercent: number | null;
}

export interface CalendarCell {
  date: string | null;
  count: number;
  level: number;
}

export interface CalendarWeek {
  cells: CalendarCell[];
}

/** 연간 그리드 상단 월 라벨(주 열 인덱스) */
export interface CalendarMonthLabel {
  weekIndex: number;
  label: string;
}

export interface ConversationTone {
  laughMessages: number;
  laughPer100: number;
  shortMessages: number;
  shortPer100: number;
  emojiPer100: number;
}

export interface ReportStory {
  headline: string;
  wrapped: WrappedCard[];
  personas: ParticipantPersona[];
  chapters: StoryChapter[];
  calendarWeeks: CalendarWeek[];
  calendarSpanLabel: string;
  /** 그리드 기간 내 메시지 합(잔디 셀 합) */
  calendarTotalMessages: number;
  calendarMonthLabels: CalendarMonthLabel[];
  tone: ConversationTone;
}

/** 고급 집계·행동 패턴 지표(원문 미저장, 통계 전용) */
export interface ReportInsights {
  /** 토·일 메시지 비중(%) */
  weekendSharePercent: number;
  /** 참여자 메시지 수 불평등(Gini, 0=완전 균등, 1에 가까울수록 소수 집중) */
  participantGini: number | null;
  /** 연속 메시지 간격의 90퍼센타일(분) — 꼬리가 길수록 가끔 긴 침묵 */
  replyGapP90Minutes: number | null;
  /** 활동이 있었던 날 사이 최대 ‘빈’ 일수(인접 활동일 기준) */
  maxSilenceBetweenActiveDays: number | null;
  /** 메시지 상위 3명이 차지한 비율(%) */
  top3ParticipantSharePercent: number;
  /** 링크 도메인 분포의 샤논 엔트로피(bit). 다양할수록 큼 */
  linkDomainEntropyBits: number | null;
  /** 첫날~마지막날 달력 일수로 나눈 일평균 메시지(스팬 0일이면 null) */
  densityMessagesPerCalendarDay: number | null;
  /** 물음표(?, ？) 포함 메시지 비율(100메시지당) */
  questionLikeMessagesPer100: number;
  /** 발화자가 바뀐 비율(100메시지당 화자 전환 횟수) */
  speakerSwitchRatePer100: number;
  /** 0~100 종합 ‘리듬’ 점수(참여 균형·연속 활동·밀도 가중) */
  rhythmScore: number;
  /** 시간대 세그먼트(새벽0~5, 오전6~11, 오후12~17, 저녁18~23) 비율 합계 100에 근접 */
  daypartPercents: { key: string; label: string; percent: number }[];
  /** 100메시지당 URL 포함 메시지 수 */
  linksPer100: number;
  /** 100메시지당 첨부 포함 메시지 수 */
  attachmentsPer100: number;
  /** 참여자 1인당 메시지 수 중앙값 */
  medianMessagesPerParticipant: number | null;
  /** 응답 간격 1분 미만 비율(%) — 빠른 왕복 */
  burstGapUnder1mPercent: number | null;
  /** 응답 간격 60분 초과 비율(%) — 비동기 대화 */
  gapOver60mPercent: number | null;
  /** 메시지가 1건 이상 있었던 시각(0~23) 개수 */
  activeHoursCount: number;
  /** 키워드 토큰 중 1위가 차지한 비율(%) */
  keywordTop1SharePercent: number | null;
  /** 첨부 마커 합계 중 ‘사진’ 비중(%) */
  photoShareOfAllAttachmentMarkers: number | null;
  /** 동일인 3연속 이상 메시지 비중(%) — 독백·정리형 발화 */
  monologueMessagesPercent: number;
  /** 일별 최대 메시지가 전체에서 차지한 비율(%) */
  peakDaySharePercent: number;
  /** 서로 다른 링크 도메인 수 */
  uniqueDomainCount: number;
  /** 응답 간격 변동계수(σ/μ, 무차원). 클수록 템포 들쭉날쭉 */
  replyGapCoeffVariation: number | null;
  /** 키워드 토큰 다양성(유형÷히트, %) — 높을수록 단어가 고르게 퍼짐 */
  lexicalTypeRichnessPercent: number | null;
  /** 30분 이상 침묵으로 나눈 대화 세션 수 */
  sessionCount: number;
  /** 세션당 평균 메시지 수 */
  avgMessagesPerSession: number | null;
  /** 세션 길이 중앙값(분) */
  medianSessionMinutes: number | null;
}

/** 대화 템포 한 줄 라벨(리포트 배지용) */
export interface ConversationPace {
  label: string;
  emoji: string;
  detail: string;
}

/** 기간 구간별 메시지·활동일(처음/마지막 7일 vs 전체) */
export interface ActivityArcSegment {
  id: "head" | "tail" | "whole";
  label: string;
  messages: number;
  activeDays: number;
}

/** 일별 입퇴장·가림·신규 참여(운영·유입 펄스) */
export interface DailyRoomPulse {
  date: string;
  join: number;
  leave: number;
  hidden: number;
  kick: number;
  newSenders: number;
}

/** 화자 A → B 응답(직전 화자 기준) */
export interface InteractionDyad {
  fromAlias: string;
  toAlias: string;
  replies: number;
}

export interface InteractionMatrix {
  aliases: string[];
  matrix: number[][];
  topPairs: InteractionDyad[];
  totalReplies: number;
  /** aliases[i] 참여자의 총 메시지 수(축 정렬 검증·차트용) */
  messageCounts?: number[];
}

export interface ReportTimelineEvent {
  date: string;
  kind: string;
  title: string;
  detail: string;
  metric?: number;
  jumpId?: string;
}

export interface LlmInsights {
  insightBullets?: string[];
  shopSearchSummary?: string;
  dyadInsight?: string;
  topicProposals?: { title: string; terms: string[] }[];
}

export interface RoomNarrative {
  ogSummary: string;
  paragraphs: string[];
}

export interface PeriodCompareSlice {
  id: string;
  label: string;
  messages: number;
  activeDays: number;
  messagesPerActiveDay: number;
}

export interface PeriodComparison {
  slices: PeriodCompareSlice[];
  keywordShift: {
    head: string[];
    tail: string[];
    onlyHead: string[];
    onlyTail: string[];
  };
}

export interface BenchmarkMetric {
  key: string;
  label: string;
  value: number;
  percentile: number;
  band: string;
}

/** 리포트 내 날짜 브러시용 집계만 */
export interface ExplorerPayload {
  daily: DailyCount[];
  hourly: number[];
  monthly: DailyCount[];
  range: { min: string; max: string };
}

/** 리포트 생성 단계별 소요(ms) — CLI가 채움 */
export interface ReportBuildTiming {
  parseAggregateMs: number;
  renderHtmlMs: number;
  writeFileMs: number;
  totalMs: number;
}

/** HTML 리포트 생성·분석 provenance (CLI가 채움) */
export interface ReportProvenance {
  generator: {
    name: "kakaotalk-chat-analyzer";
    version: string;
    invokedVia?: { name: "kcachat"; version: string };
  };
  runtime?: { node: string; platform: string; arch: string };
  analysis: {
    privacy: PrivacyMode;
    top: number;
    since?: string;
    workerRequested?: boolean | "auto";
    workerUsed?: boolean;
    semanticRequested?: boolean | "auto";
    semanticUsed: boolean;
    sentimentRequested?: boolean | "auto";
    sentimentUsed: boolean;
    profanityLexiconVersion?: string;
    kiwiAvailable: boolean;
    topicModel?: "graph" | "embedding" | "hybrid";
    preset?: string;
    presetSource?: string;
    semanticModel?: string;
    semanticCap?: number;
    semanticSkippedReason?: string;
    sentimentModel?: string;
    sentimentSkippedReason?: string;
    llmTier?: string;
    llmUsed?: boolean;
    llmSkippedReason?: string;
    llmModelId?: string;
    embeddingTopics?: boolean;
    budgetMs?: number;
    envOverrides?: string[];
    gpu?: string;
  };
  output?: {
    htmlBytes: number;
    buildTiming?: ReportBuildTiming;
  };
  /** 리포트 템플릿·차트 페이로드 구분 — 기능 추가 시 bump */
  reportSchema?: string;
}

export interface ReportData {
  generatedAt: string;
  /** 분석·HTML·저장 소요 (없으면 표시 생략) */
  buildTiming?: ReportBuildTiming;
  /** 생성 도구·런타임·분석 옵션 (CLI) */
  provenance?: ReportProvenance;
  /** 집계가 끝난 스레드(메인·Worker)에서 Kiwi가 준비됐는지 */
  kiwiAvailableAtAnalysis?: boolean;
  privacy: PrivacyMode;
  source: {
    fileName: string;
    /** KakaoTalk CSV 파일명에서 추출한 채팅방 표시명 */
    chatRoomName: string;
    encoding: EncodingName;
    physicalLines: number;
    warnings: number;
  };
  summary: {
    totalMessages: number;
    participants: number;
    activeDays: number;
    firstMessage: string | null;
    lastMessage: string | null;
    averageMessageLength: number;
    messagesWithLinks: number;
    messagesWithAttachments: number;
    /** 활동일 기준 하루 평균 메시지 수 */
    messagesPerActiveDay: number;
    /** 연속으로 메시지가 있었던 최대 일수 */
    longestActiveStreakDays: number;
    /** 가장 말이 많았던 시(0~23) */
    peakHour: number | null;
    /** 가장 활발한 요일 라벨(리포트 언어) */
    busiestWeekdayLabel: string | null;
    /** 연속 메시지 간격 중앙값(분). 표본 없으면 null */
    medianReplyGapMinutes: number | null;
    /** 심야(23~05) 메시지 비율(%) */
    nightSharePercent: number;
    /** 이모지/픽토그램이 포함된 메시지 수(대략적) */
    emojiMessages: number;
    /** 시맨틱 임베딩 클러스터 키워드를 반영했는지 */
    usedSemanticKeywords?: boolean;
    /** transformers 감정 분석 샘플을 반영했는지 */
    usedSentimentAnalysis?: boolean;
    /** 로컬 LLM(Qwen GGUF) 서사·주제 보강 사용 여부 */
    usedLlmAnalysis?: boolean;
  };
  insights: ReportInsights;
  participants: ParticipantStat[];
  /** 글자 수 내림차순(표시 상한은 top과 동일) */
  participantsByCharacters: ParticipantStat[];
  profanity: ProfanityStats;
  sentiment: SentimentStats | null;
  daily: DailyCount[];
  hourly: number[];
  weekdays: CountItem[];
  /** YYYY-MM 월별 메시지 수 */
  monthly: DailyCount[];
  attachments: CountItem[];
  domains: CountItem[];
  /** 메시지 df 순(빈도 뷰·기본) */
  keywords: CountItem[];
  /** BM25 합성점수 순(특이어 뷰) */
  keywordsDistinctive: CountItem[];
  /** 대화 주제 맵(최대 8) */
  topics: ReportTopic[];
  roomEvents: RoomEventStats;
  /** 3회 이상 동일 본문 */
  repeatedPhrases: RepeatedPhraseStat[];
  /** 샵검색 #주제 상위 */
  shopSearchTopics: CountItem[];
  /** KCA_DEBUG_SHOP=1 시 미추출 알림 샘플 */
  shopSearchMissSamples?: string[];
  /** ㅋㅎ만 있는 짧은 리액션 */
  pureLaughMessages: number;
  /** 템포·패턴 한 줄 요약 */
  conversationPace: ConversationPace;
  /** 평소 대비 메시지 급증일 */
  burstDays: DailyCount[];
  /** 처음·마지막 7일 vs 전체 비교 */
  activityArc: ActivityArcSegment[];
  /** 일별 운영·유입 펄스 */
  roomPulse: DailyRoomPulse[];
  /** 리포트 상단에 보여줄 한 줄 인사이트(한국어) */
  highlights: string[];
  /** Wrapped·챕터·페르소나 등 스토리 레이어 */
  story: ReportStory;
  /** 답장·상호작용 행렬(상위 참여자) */
  interaction: InteractionMatrix | null;
  /** 이벤트 타임라인 */
  timeline: ReportTimelineEvent[];
  /** 규칙 기반 방 프로필 서사 */
  narrative: RoomNarrative;
  /** LLM 보강 시 추가 인사이트(quality/custom) */
  llmInsights?: LlmInsights;
  /** 처음/마지막·키워드 시프트 */
  periodCompare: PeriodComparison;
  /** 합성 참고 분위수(추정) */
  benchmarks: BenchmarkMetric[];
  /** 클라이언트 탐색용 집계 */
  explorer: ExplorerPayload;
  /** 오픈채팅 환영·규칙 복붙 등 키워드 분석 제외 건수 */
  openChatBoilerplateExcluded: number;
  /** 급증일 탐지 방식 */
  burstDetectionMethod: "heuristic" | "mad";
}
