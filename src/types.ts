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

export interface DailyCount {
  date: string;
  count: number;
}

export interface ReportData {
  generatedAt: string;
  privacy: PrivacyMode;
  source: {
    fileName: string;
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
  participants: ParticipantStat[];
  daily: DailyCount[];
  hourly: number[];
  weekdays: CountItem[];
  /** YYYY-MM 월별 메시지 수 */
  monthly: DailyCount[];
  attachments: CountItem[];
  domains: CountItem[];
  keywords: CountItem[];
  /** 리포트 상단에 보여줄 한 줄 인사이트(한국어) */
  highlights: string[];
}
