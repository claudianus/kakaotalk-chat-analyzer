/**
 * 대용량 카톡 CSV 스트리밍 탐색 (RAM 상한: 카운터·상위 N 맵만 유지)
 * Usage: node scripts/explore-export.mjs "/path/to/export.csv"
 */
import { streamKakaoExport } from "../dist/src/stream-parser.js";
import { detectSystemNotice } from "../dist/src/room-events.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/explore-export.mjs <csv-path>");
  process.exit(1);
}

const ATTACHMENT_HINTS = [
  "사진",
  "동영상",
  "이모티콘",
  "음성메시지",
  "보이스톡",
  "파일",
  "지도",
  "연락처",
  "카카오톡 프로필",
  "선물",
  "투표",
  "일정",
  "게시판",
];

const POLITICAL_TERMS = [
  "이재명",
  "윤석열",
  "국힘",
  "민주",
  "더불어",
  "찬성",
  "반대",
  "탄핵",
  "대선",
  "지지",
  "혐오",
  "정치",
  "보수",
  "진보",
  "좌파",
  "우파",
];

const SYSTEM_PREFIX_RE =
  /^(?:.+님이\s|메시지가\s|운영자|관리자|공지|채팅방|오픈채팅|투표|일정|게시글|님이\s+부방장|님이\s+방장)/u;

const LAUGH_RE = /[ㅋㅎ]{2,}|ㅋ+|ㅎ+|ㅠ+|ㅜ+|LOL|lol/i;
const URL_RE = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

const MAX_MAP = 8000;
const TOP_SENDERS = 30;
const TOP_MSG_SAMPLES = 40;

const c = {
  records: 0,
  multiline: 0,
  emptyMsg: 0,
  sysJoin: 0,
  sysLeave: 0,
  sysDeleted: 0,
  attachmentHits: 0,
  laugh: 0,
  question: 0,
  url: 0,
  allCaps: 0,
  singleChar: 0,
  veryShort: 0, // 1-3 chars
  longMsg: 0, // > 500
  politicalHit: 0,
  systemPrefix: 0,
  mentionAt: 0,
};

const lenBuckets = [0, 0, 0, 0, 0]; // 0, 1-10, 11-50, 51-200, 200+
const hours = Array(24).fill(0);
const attachCounts = new Map();
const politicalCounts = new Map();
const domainCounts = new Map();
const systemMsgCounts = new Map();
const repeatMsgCounts = new Map();
const senderCounts = new Map();

let firstDate = null;
let lastDate = null;

function bump(map, key, n = 1) {
  if (!key || key.length > 500) return;
  map.set(key, (map.get(key) ?? 0) + n);
  if (map.size > MAX_MAP) trimMap(map, Math.floor(MAX_MAP * 0.7));
}

function trimMap(map, keep) {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, keep);
  map.clear();
  for (const [k, v] of sorted) map.set(k, v);
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function isAttachmentLine(msg) {
  const t = msg.trim();
  return ATTACHMENT_HINTS.some((h) => t === h || t.startsWith(h));
}

function looksLikeUnknownSystem(msg) {
  const t = msg.trim().replace(/\s+/g, " ");
  if (!t || t.length > 120) return false;
  if (detectSystemNotice(t)) return false;
  if (isAttachmentLine(t)) return false;
  if (SYSTEM_PREFIX_RE.test(t)) return true;
  if (/\.(습니다|였습니다|되었습니다)\.?$/u.test(t) && t.length < 80) return true;
  if (/^님이\s/u.test(t)) return true;
  return false;
}

function normalizeSample(msg) {
  return msg.trim().replace(/\s+/g, " ").slice(0, 200);
}

let lastProgress = 0;

for await (const ev of streamKakaoExport(filePath, {
  progressEvery: 50_000,
  onProgress: (n) => {
    if (n - lastProgress >= 50_000) {
      process.stderr.write(`… ${n.toLocaleString()} records\n`);
      lastProgress = n;
    }
  },
})) {
  if (ev.type !== "record") continue;
  const { sender, message: msg, date } = ev.record;
  c.records += 1;

  const dateKey =
    typeof date === "string"
      ? date.slice(0, 10)
      : `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  if (!firstDate) firstDate = dateKey;
  lastDate = dateKey;

  const hour = typeof date === "string" ? parseInt(date.slice(11, 13), 10) : date.hour;
  if (hour >= 0 && hour < 24) hours[hour] += 1;

  bump(senderCounts, sender);

  const len = msg.length;
  if (len === 0) c.emptyMsg += 1;
  else if (len <= 10) lenBuckets[1] += 1;
  else if (len <= 50) lenBuckets[2] += 1;
  else if (len <= 200) lenBuckets[3] += 1;
  else {
    lenBuckets[4] += 1;
    if (len > 500) c.longMsg += 1;
  }

  if (msg.includes("\n")) c.multiline += 1;

  const sys = detectSystemNotice(msg);
  if (sys === "join") c.sysJoin += 1;
  else if (sys === "leave") c.sysLeave += 1;
  else if (sys === "deleted") c.sysDeleted += 1;

  if (isAttachmentLine(msg)) {
    c.attachmentHits += 1;
    const label = msg.trim().split("\n")[0].slice(0, 40);
    bump(attachCounts, label);
  }

  if (LAUGH_RE.test(msg)) c.laugh += 1;
  if (msg.includes("?") || msg.includes("？")) c.question += 1;
  if (URL_RE.test(msg)) {
    c.url += 1;
    for (const u of msg.matchAll(/https?:\/\/([^/\s?#]+)/gi)) {
      bump(domainCounts, u[1].toLowerCase().replace(/^www\./, ""));
    }
  }

  if (len === 1) c.singleChar += 1;
  if (len > 0 && len <= 3) c.veryShort += 1;

  if (len > 5 && len < 80 && msg === msg.toUpperCase() && /[가-힣]/.test(msg)) c.allCaps += 1;

  if (msg.includes("@")) c.mentionAt += 1;

  for (const term of POLITICAL_TERMS) {
    if (msg.includes(term)) {
      c.politicalHit += 1;
      bump(politicalCounts, term);
      break;
    }
  }

  if (SYSTEM_PREFIX_RE.test(msg.trim())) c.systemPrefix += 1;

  if (looksLikeUnknownSystem(msg)) {
    bump(systemMsgCounts, normalizeSample(msg));
  }

  if (len >= 8 && len <= 300 && !sys && !isAttachmentLine(msg)) {
    bump(repeatMsgCounts, normalizeSample(msg));
  }
}

const uniqueSenders = senderCounts.size;
const peakHour = hours.indexOf(Math.max(...hours));

const report = {
  file: filePath,
  records: c.records,
  span: { first: firstDate, last: lastDate },
  uniqueSenders,
  systemNotices: {
    join: c.sysJoin,
    leave: c.sysLeave,
    deleted: c.sysDeleted,
    total: c.sysJoin + c.sysLeave + c.sysDeleted,
    sharePercent: round((100 * (c.sysJoin + c.sysLeave + c.sysDeleted)) / c.records, 2),
  },
  attachments: {
    hits: c.attachmentHits,
    sharePercent: round((100 * c.attachmentHits) / c.records, 2),
    top: topN(attachCounts, 15),
  },
  messageShape: {
    multiline: c.multiline,
    multilinePercent: round((100 * c.multiline) / c.records, 2),
    empty: c.emptyMsg,
    veryShort_1to3: c.veryShort,
    singleChar: c.singleChar,
    long_over500: c.longMsg,
    lengthBuckets: {
      empty: c.emptyMsg,
      "1-10": lenBuckets[1],
      "11-50": lenBuckets[2],
      "51-200": lenBuckets[3],
      "200+": lenBuckets[4],
    },
  },
  reactions: {
    laugh: c.laugh,
    laughPercent: round((100 * c.laugh) / c.records, 2),
    question: c.question,
    questionPercent: round((100 * c.question) / c.records, 2),
    allCaps: c.allCaps,
    mentionAt: c.mentionAt,
  },
  political: {
    messagesWithTerm: c.politicalHit,
    percent: round((100 * c.politicalHit) / c.records, 2),
    topTerms: topN(politicalCounts, 12),
  },
  urls: { count: c.url, topDomains: topN(domainCounts, 12) },
  peakHour,
  topSenders: topN(senderCounts, TOP_SENDERS),
  unknownSystemTemplates: topN(systemMsgCounts, TOP_MSG_SAMPLES),
  topRepeatedMessages: topN(repeatMsgCounts, 15).filter(([, n]) => n >= 5),
  systemPrefixHits: c.systemPrefix,
};

console.log(JSON.stringify(report, null, 2));

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
