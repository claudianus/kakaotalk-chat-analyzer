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
  /** 23~05시(심야) 메시지 수 */
  nightMessages: number;
  /** 동일 발신자 연속 메시지 최대 길이 */
  maxConsecutive: number;
}

export interface CountItem {
  label: string;
  count: number;
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
  photoBundleCount: number;
  total: number;
  joinSharePercent: number;
  leaveSharePercent: number;
  deletedSharePercent: number;
  hiddenSharePercent: number;
  kickSharePercent: number;
}

/** 동일 문구 반복(카피페asta·환영문 등) */
export interface RepeatedPhraseStat {
  label: string;
  count: number;
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
}

export interface ReportData {
  generatedAt: string;
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
  };
  insights: ReportInsights;
  participants: ParticipantStat[];
  daily: DailyCount[];
  hourly: number[];
  weekdays: CountItem[];
  /** YYYY-MM 월별 메시지 수 */
  monthly: DailyCount[];
  attachments: CountItem[];
  domains: CountItem[];
  keywords: CountItem[];
  roomEvents: RoomEventStats;
  /** 3회 이상 동일 본문 */
  repeatedPhrases: RepeatedPhraseStat[];
  /** 샵검색 #주제 상위 */
  shopSearchTopics: CountItem[];
  /** ㅋㅎ만 있는 짧은 리액션 */
  pureLaughMessages: number;
  /** 리포트 상단에 보여줄 한 줄 인사이트(한국어) */
  highlights: string[];
  /** Wrapped·챕터·페르소나 등 스토리 레이어 */
  story: ReportStory;
}
