/** 카카오톡 CSV 시스템·운영 알림 (본문 키워드와 분리 집계) */
export type SystemNoticeKind =
  | "join"
  | "leave"
  | "deleted"
  | "hidden"
  | "kick"
  | "slowModeOn"
  | "slowModeOff"
  | "subManager"
  | "manager"
  | "shopSearch"
  | "photoBundle";

/** @deprecated */
export type RoomEventKind = "join" | "leave";

const JOIN_LINE =
  /^(?:.+님이\s*)?들어왔습니다\.?$|^.+님이\s+들어왔습니다\.?$/u;
const LEAVE_LINE =
  /^(?:.+님이\s*)?나갔습니다\.?$|^.+님이\s+나갔습니다\.?$/u;
const DELETED_LINE = /^메시지가\s+삭제되었습니다\.?$/u;
const HIDDEN_LINE = /^관리자가\s+메시지를\s+가렸습니다\.?$/u;
const KICK_LINE = /^.{0,48}님을\s*(?:내)?보냈습니다\.?$/u;
const SLOW_ON_LINE = /^관리자만\s+말하기\s+기능이\s+활성화되었습니다\.?$/u;
const SLOW_OFF_LINE = /^관리자만\s+말하기\s+기능이\s+해제되었습니다\.?$/u;
const SUB_MANAGER_LINE = /^.+님이\s+부방장이\s+되었습니다\.?$/u;
const MANAGER_LINE = /^.+님이\s+방장이\s+되었습니다\.?$/u;
const SHOP_SEARCH_LINE = /^샵검색[:\s]+(.+)$/u;
const SHOP_SEARCH_HASH_ONLY = /^#\S{2,80}$/u;
const PHOTO_BUNDLE_LINE = /^사진\s+\d+\s*장$/u;

/** CSV 연속 줄에 붙는 시스템 꼬리 (`,"","…"`) */
const EMBEDDED_SYS_RE = /,\s*"",\s*"([^"]+)"/g;

export const SYSTEM_NOTICE_KEYWORD_STOP = new Set([
  "들어왔습니다",
  "나갔습니다",
  "삭제되었습니다",
  "가렸습니다",
  "메시지가",
  "보냈습니다",
  "활성화되었습니다",
  "해제되었습니다",
  "부방장이",
  "방장이",
  "샵검색",
]);

const OPEN_CHAT_WELCOME_RE = /반가워[!]?\s*닉\s*옆에\s*정치성향/u;
const OPEN_CHAT_RULE_RE = /(초중반\s*가리|강퇴\s*기준|비속어|정치성향\s*라벨|초중반가려)/u;

/** 오픈채팅 환영·규칙 복붙 문구 — 키워드·반복 문구에서 제외 */
export function isOpenChatBoilerplate(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length < 24) return false;
  if (OPEN_CHAT_WELCOME_RE.test(t)) return true;
  return OPEN_CHAT_RULE_RE.test(t) && t.length >= 48;
}

/** @deprecated */
export const ROOM_EVENT_KEYWORD_STOP = SYSTEM_NOTICE_KEYWORD_STOP;

export function normalizeNoticeLine(line: string): string {
  return line
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\s+/g, " ");
}

export function detectSystemNoticeLine(line: string): SystemNoticeKind | null {
  const t = normalizeNoticeLine(line);
  if (!t) return null;
  if (DELETED_LINE.test(t)) return "deleted";
  if (HIDDEN_LINE.test(t)) return "hidden";
  if (SLOW_ON_LINE.test(t)) return "slowModeOn";
  if (SLOW_OFF_LINE.test(t)) return "slowModeOff";
  if (SUB_MANAGER_LINE.test(t)) return "subManager";
  if (MANAGER_LINE.test(t)) return "manager";
  if (SHOP_SEARCH_LINE.test(t)) return "shopSearch";
  if (PHOTO_BUNDLE_LINE.test(t)) return "photoBundle";
  if (KICK_LINE.test(t) && !/선물과\s+메시지를\s+보냈습니다/.test(t)) return "kick";
  if (LEAVE_LINE.test(t)) return "leave";
  if (JOIN_LINE.test(t)) return "join";
  return null;
}

/** @deprecated */
export function detectSystemNotice(message: string): SystemNoticeKind | null {
  return detectSystemNoticeLine(message);
}

export function detectRoomEvent(message: string): RoomEventKind | null {
  const kind = detectSystemNoticeLine(message);
  if (kind === "join" || kind === "leave") return kind;
  return null;
}

export function isSystemNoticeMessage(message: string): boolean {
  return splitMessageForAnalysis(message).notices.length > 0;
}

export function isRoomEventMessage(message: string): boolean {
  return isSystemNoticeMessage(message);
}

export interface MessageAnalysisSplit {
  /** 키워드·본문 통계에 쓸 사용자 텍스트 */
  userText: string;
  notices: SystemNoticeKind[];
  shopSearchTags: string[];
}

function extractEmbeddedSystemLines(raw: string): string[] {
  const out: string[] = [];
  for (const m of raw.matchAll(EMBEDDED_SYS_RE)) {
    const body = m[1];
    if (body) out.push(body);
  }
  return out;
}

function normalizeShopSearchTag(raw: string): string | null {
  let tag = raw.trim().slice(0, 80);
  if (!tag) return null;
  if (!tag.startsWith("#")) tag = `#${tag}`;
  if (tag.length < 2) return null;
  return tag;
}

export function extractShopSearchTag(line: string): string | null {
  const t = normalizeNoticeLine(line);
  const m = t.match(SHOP_SEARCH_LINE);
  if (m?.[1]) return normalizeShopSearchTag(m[1]);
  if (SHOP_SEARCH_HASH_ONLY.test(t)) return normalizeShopSearchTag(t);
  return null;
}

/** 멀티라인·CSV 꼬리에서 시스템 알림 분리 */
export function splitMessageForAnalysis(message: string): MessageAnalysisSplit {
  const notices: SystemNoticeKind[] = [];
  const shopSearchTags: string[] = [];
  const userParts: string[] = [];

  for (const rawLine of message.split("\n")) {
    const line = normalizeNoticeLine(rawLine.replace(/,\s*"",\s*"/g, "").replace(/"$/g, ""));
    if (!line) continue;
    if (pushDetectedLine(line, notices, shopSearchTags)) continue;
    userParts.push(rawLine);
  }

  const userText = userParts.join("\n").trim();
  const collapsed = collapseModerationTails(notices, userText.length > 0);
  return { userText, notices: collapsed, shopSearchTags };
}

/** 본문 뒤 CSV 꼬리(가림·삭제)는 한 번만 hidden 으로 집계 */
function collapseModerationTails(notices: SystemNoticeKind[], hasUserText: boolean): SystemNoticeKind[] {
  if (!hasUserText) return notices;
  const out: SystemNoticeKind[] = [];
  let moderation = false;
  for (const kind of notices) {
    if (kind === "hidden" || kind === "deleted") {
      if (!moderation) {
        out.push("hidden");
        moderation = true;
      }
      continue;
    }
    out.push(kind);
  }
  return out;
}

function pushDetectedLine(
  line: string,
  notices: SystemNoticeKind[],
  shopSearchTags: string[],
): boolean {
  const kind = detectSystemNoticeLine(line);
  if (!kind) return false;
  notices.push(kind);
  if (kind === "shopSearch") {
    const tag = extractShopSearchTag(line);
    if (tag) shopSearchTags.push(tag);
  }
  return true;
}

export const SYSTEM_NOTICE_LABELS: Record<SystemNoticeKind, string> = {
  join: "들어왔습니다 (입장)",
  leave: "나갔습니다 (퇴장)",
  deleted: "메시지가 삭제되었습니다",
  hidden: "관리자가 메시지를 가렸습니다",
  kick: "님을보냈습니다 (강퇴)",
  slowModeOn: "관리자만 말하기 (켜짐)",
  slowModeOff: "관리자만 말하기 (꺼짐)",
  subManager: "부방장 임명",
  manager: "방장 임명",
  shopSearch: "샵검색",
  photoBundle: "사진 묶음",
};
