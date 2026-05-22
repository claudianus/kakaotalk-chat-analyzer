import type { ReportData } from "./types.js";
import { escapeHtml, renderHighlightLine } from "./report-util.js";

export function hasLlmStoryDeck(data: ReportData): boolean {
  const ins = data.llmInsights;
  if (!ins) return false;
  return Boolean(
    ins.roomArchetype ||
      (ins.moments?.length ?? 0) > 0 ||
      (ins.episodeCards?.length ?? 0) > 0 ||
      (ins.relationshipBeats?.length ?? 0) > 0 ||
      (ins.characterCards?.length ?? 0) > 0 ||
      (ins.insideJokes?.length ?? 0) > 0 ||
      (ins.dayMicroStories?.length ?? 0) > 0,
  );
}

export function renderLlmArchetypeBanner(data: ReportData): string {
  const arch = data.llmInsights?.roomArchetype;
  if (!arch) return "";
  const hasTraits = Array.isArray(arch.traits) && arch.traits.length > 0;
  const traitsHtml = hasTraits
    ? arch.traits
        .map(
          (t) =>
            `<span class="llm-trait-chip"><span class="llm-trait-dot" aria-hidden="true"></span>${escapeHtml(t)}</span>`,
        )
        .join("")
    : "";
  const fallbackHtml = !hasTraits
    ? `<div class="llm-trait-row llm-trait-row--fallback"><span class="llm-trait-chip llm-trait-chip--fallback">${escapeHtml(arch.name)}의 특징적인 대화 패턴</span></div>`
    : "";
  return `<section id="s-archetype" class="llm-archetype-banner anim-enter" style="--enter-delay:0.025s" aria-label="방 아키타입">
    <p class="llm-archetype-kicker">이 방의 얼굴</p>
    <h2 class="llm-archetype-name">${escapeHtml(arch.name)}</h2>
    <p class="llm-archetype-desc">${renderHighlightLine(arch.description)}</p>
    ${traitsHtml ? `<div class="llm-trait-row">${traitsHtml}</div>` : fallbackHtml}
  </section>`;
}

export function renderLlmEpisodeStrip(data: ReportData): string {
  const cards = data.llmInsights?.episodeCards;
  if (!cards?.length) return "";
  const inner = cards
    .map(
      (c) =>
        `<article class="llm-episode-card" role="listitem">
      <span class="llm-episode-emoji" aria-hidden="true">${escapeHtml(c.emoji)}</span>
      <p class="llm-episode-period">${escapeHtml(c.period)}</p>
      <h3 class="llm-episode-title">${escapeHtml(c.title)}</h3>
      <p class="llm-episode-tagline">${escapeHtml(c.tagline)}</p>
    </article>`,
    )
    .join("");
  return `<section id="s-episodes" class="llm-episode-strip anim-enter" style="--enter-delay:0.035s" aria-label="시즌 에피소드">
    <h2 class="llm-strip-title">시즌 에피소드</h2>
    <div class="llm-episode-scroll" role="list">${inner}</div>
  </section>`;
}

export function renderLlmMomentsBlock(data: ReportData): string {
  const ins = data.llmInsights;
  const moments = ins?.moments;
  const hasNarrative = data.narrative.paragraphs.length > 0 || Boolean(ins);
  if (!hasNarrative) return "";
  const paras = data.narrative.paragraphs
    .map((p) => `<p class="narrative-p">${renderHighlightLine(p)}</p>`)
    .join("");
  const momentCards = (moments ?? [])
    .map(
      (m) =>
        `<article class="llm-moment-card" role="listitem">
      <h3>${renderHighlightLine(m.headline)}</h3>
      <p class="llm-moment-ref">${escapeHtml(m.statRef)}</p>
    </article>`,
    )
    .join("");
  const hint = data.summary.usedLlmAnalysis
    ? "통계·키워드만 입력한 <strong>로컬 LLM</strong>이 서사·순간을 보강했습니다(원문 미포함)."
    : "규칙·통계만으로 만든 <strong>재현 가능</strong>한 요약이에요.";
  return `<section id="s-narrative" class="card narrative-card anim-enter" style="margin-bottom:14px;--enter-delay:0.04s" aria-label="방 이야기">
    <h2 class="section-glow">② 방 이야기</h2>
    <p class="chart-hint">${hint}</p>
    <div class="narrative-body">${paras}</div>
    ${momentCards ? `<div class="llm-moments-grid" role="list">${momentCards}</div>` : ""}
    ${renderLlmDeckExtras(ins)}
  </section>`;
}

function renderLlmDeckExtras(ins: ReportData["llmInsights"]): string {
  if (!ins) return "";
  // insightBullets가 배열이 아닐 수 있음 (방어적 처리)
  const rawBullets = Array.isArray(ins.insightBullets) ? ins.insightBullets : [];
  const bullets = rawBullets
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0 && b !== "insightBullets")
    .map((b) => `<li>${renderHighlightLine(b)}</li>`)
    .join("");
  const proposals = (ins.topicProposals ?? [])
    .map(
      (p) =>
        `<li><strong>${escapeHtml(p.title)}</strong> — ${p.terms.map((t) => escapeHtml(t)).join(", ")}</li>`,
    )
    .join("");
  const parts = [
    bullets ? `<h3 class="insight-sub">인사이트</h3><ul class="llm-bullets">${bullets}</ul>` : "",
    ins.shopSearchSummary
      ? `<p class="llm-extra"><strong>샵검색</strong> ${renderHighlightLine(ins.shopSearchSummary)}</p>`
      : "",
    ins.dyadInsight
      ? `<p class="llm-extra"><strong>상호작용</strong> ${renderHighlightLine(ins.dyadInsight)}</p>`
      : "",
    proposals
      ? `<div class="llm-topic-proposals"><h3 class="insight-sub">주제 제안</h3><ul class="llm-bullets">${proposals}</ul></div>`
      : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `<div class="llm-insights" style="margin-top:12px">${parts.join("")}</div>`;
}

export function renderLlmRelationshipBeats(data: ReportData): string {
  const beats = data.llmInsights?.relationshipBeats;
  if (!beats?.length) return "";
  const rows = beats
    .map(
      (b) =>
        `<li class="llm-beat-card"><strong>${escapeHtml(b.pair)}</strong>${b.role ? ` <em>${escapeHtml(b.role)}</em>` : ""}<span>${renderHighlightLine(b.beat)}</span></li>`,
    )
    .join("");
  return `<div class="llm-rel-beats"><h3 class="insight-sub">관계 드라마</h3><ul class="llm-beat-list">${rows}</ul></div>`;
}

export function renderLlmCharacterCards(data: ReportData): string {
  const cards = data.llmInsights?.characterCards;
  if (!cards?.length) return "";
  const inner = cards
    .map(
      (c) =>
        `<article class="llm-char-card" role="listitem">
      <h3>${escapeHtml(c.alias)}</h3>
      <p>${escapeHtml(c.tagline)}</p>
      <span class="llm-char-stat">${escapeHtml(c.statHook)}</span>
    </article>`,
    )
    .join("");
  return `<section id="s-characters" class="llm-char-grid anim-enter" style="margin-bottom:14px;--enter-delay:0.042s" aria-label="캐릭터 카드">
    <h2 class="llm-strip-title">캐릭터 카드</h2>
    <div class="llm-char-row" role="list">${inner}</div>
  </section>`;
}

export function renderLlmInsideJokes(data: ReportData): string {
  const jokes = data.llmInsights?.insideJokes;
  if (!jokes?.length) return "";
  const chips = jokes
    .map(
      (j) =>
        `<span class="llm-meme-chip" title="${escapeHtml(j.whyFunny)}">${escapeHtml(j.label)}</span>`,
    )
    .join("");
  return `<div class="llm-meme-row" aria-label="방 밈"><h3 class="insight-sub">방 밈</h3><div class="llm-meme-chips">${chips}</div></div>`;
}

export function renderLlmEraLabels(data: ReportData): string {
  const eras = data.llmInsights?.eraLabels;
  if (!eras?.length) return "";
  const rows = eras
    .map(
      (e) =>
        `<li><strong>${escapeHtml(e.label)}</strong><span>${escapeHtml(e.detail)}</span></li>`,
    )
    .join("");
  return `<div class="llm-era-labels"><h3 class="insight-sub">키워드 시대</h3><ul>${rows}</ul></div>`;
}

export function renderLlmDayMicroStories(data: ReportData): string {
  const days = data.llmInsights?.dayMicroStories;
  if (!days?.length) return "";
  const rows = days
    .map(
      (d) =>
        `<li><time datetime="${escapeHtml(d.date)}">${escapeHtml(d.date)}</time> ${renderHighlightLine(d.line)}</li>`,
    )
    .join("");
  return `<div class="llm-day-stories"><h3 class="insight-sub">그날의 방</h3><ul>${rows}</ul></div>`;
}

export function renderLlmShareFooter(data: ReportData): string {
  const ins = data.llmInsights;
  if (!ins?.shareLine && !(ins?.hashtags?.length) && !(ins?.counterfactuals?.length)) return "";
  const tags = (ins.hashtags ?? [])
    .map((h) => `<span class="llm-hash">#${escapeHtml(h)}</span>`)
    .join(" ");
  const cf = (ins.counterfactuals ?? [])
    .map((c) => `<p class="llm-counterfactual"><em>가상</em> ${escapeHtml(c.text)}</p>`)
    .join("");
  return `<div class="llm-share-block">
    ${ins.shareLine ? `<p class="llm-share-line">${renderHighlightLine(ins.shareLine)}</p>` : ""}
    ${tags ? `<p class="llm-hash-row">${tags}</p>` : ""}
    ${cf}
  </div>`;
}
