#!/usr/bin/env node
/**
 * CSV 한 방에 대해 휴리스틱 vs Kiwi+TF-IDF 상위 키워드를 나란히 출력합니다.
 * Usage: npm run keyword:diff -- ./KakaoTalk_Chat_....csv [limit]
 */
import { initKiwiRuntime, isKiwiReady } from "../dist/src/kiwi-runtime.js";
import { tokenizeHeuristicOnly } from "../dist/src/keyword-tokenize.js";
import { StreamingTfidfKeywords } from "../dist/src/streaming-tfidf-keywords.js";
import { streamKakaoExport } from "../dist/src/stream-parser.js";

const csvPath = process.argv[2];
const limit = Math.min(120, Math.max(10, Number(process.argv[3]) || 30));

if (!csvPath) {
  console.error("Usage: npm run keyword:diff -- <export.csv> [topN=30]");
  process.exit(1);
}

const HAS_HANGUL_OR_LATIN = /[가-힣A-Za-z]/;

await initKiwiRuntime();
const kiwiOn = isKiwiReady();
process.stderr.write(`[keyword:diff] Kiwi ${kiwiOn ? "ON" : "OFF (heuristic only)"}\n`);

const kiwiStream = new StreamingTfidfKeywords();
const heurStream = new StreamingTfidfKeywords(tokenizeHeuristicOnly);
let messages = 0;

for await (const event of streamKakaoExport(csvPath)) {
  if (event.type !== "record") continue;
  const msg = event.record.message;
  if (msg.length < 2 || !HAS_HANGUL_OR_LATIN.test(msg)) continue;
  messages += 1;
  kiwiStream.addDocument(msg);
  heurStream.addDocument(msg);
}

const opts = { limit, minDocFreq: 2 };
const kiwiKw = kiwiStream.extractKeywordItems(opts);
const heurKw = heurStream.extractKeywordItems(opts);

console.log(`\n메시지 ${messages.toLocaleString("ko-KR")}건 · 상위 ${limit}개\n`);
console.log(
  pad("Kiwi+TF-IDF", 28) +
    " │ " +
    pad("휴리스틱", 28) +
    " │ note",
);
console.log("─".repeat(72));

for (let i = 0; i < limit; i += 1) {
  const k = kiwiKw[i];
  const h = heurKw[i];
  const note =
    k && h && k.label === h.label
      ? "="
      : k && heurKw.some((x) => x.label === k.label)
        ? "~"
        : k
          ? "+"
          : "";
  console.log(
    pad(k ? `${k.label} (${k.messageHits})` : "—", 28) +
      " │ " +
      pad(h ? `${h.label} (${h.messageHits})` : "—", 28) +
      ` │ ${note}`,
  );
}

const kiwiSet = new Set(kiwiKw.map((x) => x.label));
const heurSet = new Set(heurKw.map((x) => x.label));
const onlyKiwi = [...kiwiSet].filter((l) => !heurSet.has(l));
const onlyHeur = [...heurSet].filter((l) => !kiwiSet.has(l));
console.log(`\nKiwi에만: ${onlyKiwi.slice(0, 12).join(", ") || "—"}`);
console.log(`휴리스틱에만: ${onlyHeur.slice(0, 12).join(", ") || "—"}\n`);

function pad(s, w) {
  if (s.length >= w) return s.slice(0, w - 1) + "…";
  return s + " ".repeat(w - s.length);
}
