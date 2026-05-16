export type EncodingName = "utf-8-bom" | "utf-8" | "cp949" | "euc-kr";

export type PrivacyMode = "public-anonymous";

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
  };
  participants: ParticipantStat[];
  daily: DailyCount[];
  hourly: number[];
  weekdays: CountItem[];
  attachments: CountItem[];
  domains: CountItem[];
  keywords: CountItem[];
}
