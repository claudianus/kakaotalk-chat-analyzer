import type { DailySnapshot, ParticipantRole, RecentSnapshot, ReportData } from "./types.js";
import { escapeHtml, formatNumber, renderHighlightLine } from "./report-util.js";
import { resolveCharacterCards } from "./report-character-cards.js";

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
            `<span class="llm-trait-chip">${escapeHtml(t)}</span>`,
        )
        .join("")
    : "";
  const fallbackHtml = !hasTraits
    ? `<div class="llm-trait-row llm-trait-row--fallback"><span class="llm-trait-chip llm-trait-chip--fallback">${escapeHtml(arch.name)}의 특징적인 대화 패턴</span></div>`
    : "";
  return `<section id="s-archetype" class="kca-section llm-archetype-banner kca-shot-block anim-enter" style="--enter-delay:0.025s" aria-label="방 아키타입" data-observe>
    <div class="llm-archetype-inner">
      <p class="llm-archetype-kicker">🎭 이 방의 얼굴</p>
      <h2 class="llm-archetype-name">${escapeHtml(arch.name)}</h2>
      <p class="llm-archetype-desc">${renderHighlightLine(arch.description)}</p>
      ${traitsHtml ? `<div class="llm-trait-row">${traitsHtml}</div>` : fallbackHtml}
    </div>
  </section>`;
}

export function renderLlmEpisodeStrip(data: ReportData): string {
  const cards = data.llmInsights?.episodeCards;
  if (!cards?.length) return "";
  const inner = cards
    .map(
      (c) =>
        `<article class="llm-episode-card" role="listitem" data-observe>
      <span class="llm-episode-emoji" aria-hidden="true">${escapeHtml(c.emoji)}</span>
      <p class="llm-episode-period">${escapeHtml(c.period)}</p>
      <h3 class="llm-episode-title">${renderHighlightLine(c.title)}</h3>
      <p class="llm-episode-tagline">${renderHighlightLine(c.tagline)}</p>
    </article>`,
    )
    .join("");
  return `<section id="s-episodes" class="kca-section llm-episode-strip kca-shot-block anim-enter" style="--enter-delay:0.035s" aria-label="시즌 에피소드" data-observe>
    <h2 class="llm-strip-title">🎬 시즌 에피소드</h2>
    <div class="llm-episode-scroll" role="list">${inner}</div>
  </section>`;
}

export function renderLlmMomentsBlock(data: ReportData): string {
  const ins = data.llmInsights;
  const moments = ins?.moments;
  const hasNarrative = data.narrative.paragraphs.length > 0 || Boolean(ins);
  if (!hasNarrative) return "";
  const paras = data.narrative.paragraphs
    .map(
      (p) =>
        `<article class="narrative-quote-card" data-observe><p>${renderHighlightLine(p)}</p></article>`,
    )
    .join("");
  const momentCards = (moments ?? [])
    .map(
      (m) =>
        `<article class="llm-moment-card" role="listitem" data-observe>
      <h3>${renderHighlightLine(m.headline)}</h3>
      <p class="llm-moment-ref">${escapeHtml(m.statRef)}</p>
    </article>`,
    )
    .join("");
  const hint = data.summary.usedLlmAnalysis
    ? "통계·키워드를 입력한 <strong>로컬 LLM</strong>이 보강(원문 미포함)."
    : "규칙·통계만으로 만든 요약.";
  return `<section id="s-narrative" class="kca-section card kca-card--story kca-shot-block narrative-card anim-enter" style="--enter-delay:0.04s" aria-label="방 이야기" data-observe>
    <h2 class="section-glow">② 방 이야기</h2>
    <p class="chart-hint">${hint}</p>
    <div class="narrative-quote-grid">${paras}</div>
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
        `<li class="llm-beat-card" data-observe><strong>${escapeHtml(b.pair)}</strong>${b.role ? ` <em>${escapeHtml(b.role)}</em>` : ""}<span>${renderHighlightLine(b.beat)}</span></li>`,
    )
    .join("");
  return `<div class="llm-rel-beats"><h3 class="insight-sub">💕 자주 엮이는 쌍</h3><ul class="llm-beat-list">${rows}</ul></div>`;
}

export function renderLlmCharacterCards(data: ReportData): string {
  const cards = resolveCharacterCards(data);
  if (cards.length === 0) return "";
  const inner = cards
    .map(
      (c) =>
        `<article class="llm-char-card" role="listitem" data-observe>
      <h3>${escapeHtml(c.alias)}</h3>
      <p>${renderHighlightLine(c.tagline)}</p>
      <span class="llm-char-stat">${renderHighlightLine(c.statHook)}</span>
    </article>`,
    )
    .join("");
  return `<section id="s-characters" class="kca-section llm-char-grid kca-shot-block anim-enter" style="--enter-delay:0.042s" aria-label="캐릭터 카드" data-observe>
    <h2 class="llm-strip-title">👥 캐릭터 카드</h2>
    <p class="chart-hint">메시지 상위 10명 — 말 많은 사람을 먼저 봅니다.</p>
    <div class="llm-char-row" role="list">${inner}</div>
  </section>`;
}

export function renderLlmInsideJokes(data: ReportData): string {
  const jokes = data.llmInsights?.insideJokes;
  if (!jokes?.length) return "";
  const chips = jokes
    .map(
      (j) =>
        `<span class="llm-meme-chip" title="${escapeHtml(j.whyFunny)}" data-observe>${renderHighlightLine(j.label)}</span>`,
    )
    .join("");
  return `<div class="llm-meme-row" aria-label="방 밈" data-observe><h3 class="insight-sub">😂 방 밈</h3><div class="llm-meme-chips">${chips}</div></div>`;
}

export function renderLlmEraLabels(data: ReportData): string {
  const eras = data.llmInsights?.eraLabels;
  if (!eras?.length) return "";
  const rows = eras
    .map(
      (e) =>
        `<li data-observe><strong>${escapeHtml(e.label)}</strong><span>${renderHighlightLine(e.detail)}</span></li>`,
    )
    .join("");
  return `<div class="llm-era-labels" data-observe><h3 class="insight-sub">⏳ 말이 바뀐 시기</h3><ul>${rows}</ul></div>`;
}

export function renderLlmDayMicroStories(data: ReportData): string {
  const days = data.llmInsights?.dayMicroStories;
  if (!days?.length) return "";
  const rows = days
    .slice(0, 4)
    .map(
      (d) =>
        `<li data-observe><time datetime="${escapeHtml(d.date)}">${escapeHtml(d.date)}</time> ${renderHighlightLine(d.line)}</li>`,
    )
    .join("");
  return `<div class="llm-day-stories" data-observe><h3 class="insight-sub">📅 그날의 방</h3><ul>${rows}</ul></div>`;
}

export function renderDailyHotTopics(data: ReportData): string {
  const topics = data.dailyHotTopics;
  if (!topics?.length) return "";

  const burstSet = new Set(data.burstDays.map((d) => d.date));
  const maxMsg = Math.max(...topics.map((t) => t.messageCount), 1);
  const renderTopic = (t: (typeof topics)[number]) => {
      const isBurst = burstSet.has(t.date);
      const burstCls = isBurst ? " hot-topic--burst" : "";
      const burstBadge = isBurst ? '<span class="hot-topic-badge">🔥 급증일</span>' : "";
      const keywords = t.keywords
        .slice(0, 4)
        .map((k) => `<span class="hot-topic-kw">${escapeHtml(k)}</span>`)
        .join("");
      const evidence = (t.evidence ?? [])
        .slice(0, 2)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
      const lift = typeof t.lift === "number" ? ` · 평균 ${t.lift}배` : "";
      const barW = Math.round((t.messageCount / maxMsg) * 100);
      const participants = (t.participants ?? []).slice(0, 3).join(" · ");
      return `<article class="hot-topic-card${burstCls}" role="listitem" data-observe>
        <div class="hot-topic-meta">
          <time class="hot-topic-date" datetime="${escapeHtml(t.date)}">${escapeHtml(t.date)}</time>
          ${burstBadge}
        </div>
        <h3 class="hot-topic-title">${renderHighlightLine(t.title ?? "대화 흐름")}</h3>
        ${keywords ? `<div class="hot-topic-kws">${keywords}</div>` : ""}
        <p class="hot-topic-summary">${renderHighlightLine(t.summary)}</p>
        ${evidence ? `<ul class="hot-topic-evidence">${evidence}</ul>` : ""}
        <div class="hot-topic-bar"><div class="hot-topic-bar-fill" style="width:${barW}%"></div></div>
        <div class="hot-topic-footer">
          <span class="hot-topic-count">${t.messageCount}건${lift}</span>
          ${participants ? `<span class="hot-topic-participants">주도: ${escapeHtml(participants)}</span>` : ""}
        </div>
      </article>`;
  };

  const rows = topics.slice(0, 4).map((t) => renderTopic(t)).join("");
  const more = topics.length > 4 ? ` <span class="hot-topics-more">외 ${topics.length - 4}일</span>` : "";

  return `<section id="s-hot-topics" class="kca-section hot-topics-section kca-shot-block anim-enter" style="--enter-delay:0.045s" aria-label="이 날의 핫토픽" data-observe>
    <div class="hot-topics-head">
      <h2 class="llm-strip-title">🔥 이 날의 핫토픽</h2>
      <span class="hot-topics-count">전체 ${topics.length}일${more}</span>
    </div>
    <div class="hot-topics-grid" role="list">${rows}</div>
  </section>`;
}

export function renderLlmShareFooter(data: ReportData): string {
  const ins = data.llmInsights;
  if (!ins?.shareLine && !(ins?.hashtags?.length) && !(ins?.counterfactuals?.length)) return "";
  const tags = (ins.hashtags ?? [])
    .map((h) => `<span class="llm-hash">#${escapeHtml(h)}</span>`)
    .join(" ");
  const cf = (ins.counterfactuals ?? [])
    .map((c) => `<p class="llm-counterfactual"><em>가상</em> ${renderHighlightLine(c.text)}</p>`)
    .join("");
  return `<div class="llm-share-block" data-observe>
    ${ins.shareLine ? `<p class="llm-share-line">${renderHighlightLine(ins.shareLine)}</p>` : ""}
    ${tags ? `<p class="llm-hash-row">${tags}</p>` : ""}
    ${cf}
  </div>`;
}

export function renderParticipantRoles(data: ReportData): string {
  const roles = data.participantRoles;
  if (!roles || roles.length === 0) return "";

  const ROLE_MIN_CONFIDENCE = 0.78; // 표시용 — 상위 10명은 항상 포함

  const roleEmoji: Record<string, string> = {
    주도형: "👑",
    "핵심 멤버": "⭐",
    "브론즈 코어": "🥉",
    "말 많은 1위": "🥇",
    "활동 멤버": "💬",
    참여자: "🙋",
    멤버: "👤",
    꾸준형: "📌",
    긴글러: "✍️",
    "분위기 메이커": "😂",
    리액션러: "⚡",
    "자료 공유자": "🔗",
    "첨부 장인": "🖼️",
    "심야 상주자": "🌙",
    "연속 발화자": "📣",
  };

  const roleDesc: Record<string, string> = {
    주도형: "흐름 주도",
    "핵심 멤버": "상위권 참여",
    "브론즈 코어": "3위 중심층",
    "말 많은 1위": "메시지 1위",
    "활동 멤버": "꾸준 참여",
    참여자: "대화 참여",
    멤버: "방 멤버",
    꾸준형: "자주 말함",
    긴글러: "맥락 설명",
    "분위기 메이커": "웃음 신호",
    리액션러: "빠른 반응",
    "자료 공유자": "링크 큐레이터",
    "첨부 장인": "시각 자료",
    "심야 상주자": "늦은 시간 활동",
    "연속 발화자": "긴 흐름 유지",
  };

  const cards = roles
    .slice(0, 10)
    .map((r: ParticipantRole) => {
      const emoji = roleEmoji[r.role] ?? (/\d+위 멤버$/.test(r.role) ? "🔢" : "💬");
      const desc = roleDesc[r.role] ?? (/\d+위 멤버$/.test(r.role) ? "순위별 멤버" : r.role);
      return `<article class="participant-role-card" role="listitem" data-role="${escapeHtml(r.role)}" data-observe>
        <div class="role-card-header">
          <span class="role-emoji" aria-hidden="true">${emoji}</span>
          <div class="role-info">
            <h3 class="role-alias">${escapeHtml(r.alias)}</h3>
            <span class="role-badge">${escapeHtml(desc)}</span>
          </div>
          <span class="role-confidence" title="신뢰도">${Math.round(r.confidence * 100)}%</span>
        </div>
        <p class="role-reason">${escapeHtml(r.reason)}</p>
      </article>`;
    })
    .join("");

  const countLine = `메시지 상위 <strong>10명</strong>은 항상 포함 · 그 외 뚜렷한 패턴만 추가 (최대 ${roles.length}명)`;
  return `<section id="s-participant-roles" class="kca-section participant-roles-section kca-shot-block anim-enter" style="--enter-delay:0.03s" aria-label="참여자 역할" data-observe>
    <div class="participant-roles-head">
      <h2 class="llm-strip-title">👥 참여자 역할</h2>
      <p class="chart-hint role-selection-hint">말 많은 사람부터 역할을 붙입니다. ${countLine}</p>
    </div>
    <div class="participant-roles-grid" role="list">${cards}</div>
  </section>`;
}

export function renderMemorableMomentsList(data: ReportData): string {
  const moments = data.memorableMoments;
  if (!moments || moments.length === 0) return "";

  const TYPE_ICONS: Record<string, string> = {
    peak_activity: "📈",
    emotional_spike: "💥",
    milestone: "🎯",
    conflict_resolution: "🤝",
    shared_joy: "🎉",
  };

  const items = moments
    .slice(0, 10)
    .map((m) => {
      const icon = TYPE_ICONS[m.type] ?? "💬";
      const keywordsHtml = m.keywords && m.keywords.length > 0
        ? `<div class="moment-keywords">${m.keywords
            .map((k) => `<span class="tag">${escapeHtml(k)}</span>`)
            .join("")}</div>`
        : "";
      const evidenceHtml = m.evidence && m.evidence.length > 0
        ? `<ul class="moment-evidence">${m.evidence
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("")}</ul>`
        : "";
      return `<li class="moment-item" data-observe>
        <time datetime="${escapeHtml(m.date)}">${escapeHtml(m.date)}</time>
        <span class="moment-icon" aria-hidden="true">${icon}</span>
        <div class="moment-body">
          <strong class="moment-title">${renderHighlightLine(m.title)}</strong>
          <span class="moment-desc">${renderHighlightLine(m.description)}</span>
          ${evidenceHtml}
          ${keywordsHtml}
        </div>
      </li>`;
    })
    .join("");

  return `<ul class="moments-list">${items}</ul>`;
}

export function renderMemorableMoments(data: ReportData): string {
  const list = renderMemorableMomentsList(data);
  if (!list) return "";
  return `<section id="s-memorable-moments" class="kca-section memorable-moments-section kca-shot-block anim-enter" style="--enter-delay:0.04s" aria-label="기억에 남는 순간" data-observe>
    <h2 class="llm-strip-title">✨ 기억에 남는 순간</h2>
    ${list}
  </section>`;
}

// ── 최근 7일 + 리포트 당일 스냅샷 ──

/** 0~23시간 분포를 CSS 전용 미니 바 차트로 렌더링 */
function renderMiniHourlyBar(hourly: number[], highlightHour: number | null): string {
  const max = Math.max(...hourly, 1);
  const bars = hourly
    .map((count, h) => {
      const pct = Math.round((count / max) * 100);
      const hl = h === highlightHour ? " recent-hourly-bar__seg--peak" : "";
      return `<span class="recent-hourly-bar__seg${hl}" style="--h:${pct}%" title="${h}시: ${count}건"></span>`;
    })
    .join("");
  const peakLabel =
    highlightHour !== null ? `가장 붐빈 ${highlightHour}시` : "시간대별 메시지 수";
  return `<div class="recent-chart-block">
    <div class="recent-chart-label"><span>⏰ ${peakLabel}</span><span>0~23시</span></div>
    <div class="recent-hourly-bar" aria-label="시간대 분포">${bars}</div>
  </div>`;
}

/** 감정 비율을 인라인 바로 렌더링 */
function renderSentimentInlineSmall(s: { positive: number; negative: number; neutral: number }): string {
  return `<div class="recent-chart-block">
    <div class="recent-chart-label"><span>😊 감정 비율</span><span class="recent-sentiment-legend">초록=긍정 · 빨강=부정</span></div>
    <span class="recent-sentiment-bar" title="긍정 ${s.positive}% · 부정 ${s.negative}% · 중립 ${s.neutral}%">
      <span class="recent-sentiment-bar__pos" style="width:${s.positive}%"></span>
      <span class="recent-sentiment-bar__neg" style="width:${s.negative}%"></span>
    </span>
  </div>`;
}

/** 하루 스냅샷 카드 */
function renderDaySnapshotCard(day: DailySnapshot, isToday: boolean): string {
  const cls = isToday ? "recent-day-card recent-day-card--today" : "recent-day-card";
  const label = isToday ? "📍 리포트 당일" : day.date;
  const kws = day.keywords.slice(0, 4).map((k) => `<span class="recent-day-kw">${escapeHtml(k)}</span>`).join("");
  const senders = day.topSenders.slice(0, 3).map((s) => `${escapeHtml(s.alias)}(${s.count})`).join(" · ");
  const evidence = (day.evidence ?? []).slice(0, 1).map((e) => `<li>${escapeHtml(e)}</li>`).join("");
  return `<article class="${cls}" data-observe>
    <div class="recent-day-header">
      <time datetime="${escapeHtml(day.date)}">${escapeHtml(label)}</time>
      <span class="recent-day-count">${formatNumber(day.messageCount)}건</span>
      ${day.vsAvg >= 1.5 ? '<span class="recent-day-burst">🔥</span>' : ""}
    </div>
    <div class="recent-day-meta">
      <span>참여 ${day.activeParticipants}명</span>
      ${day.peakHour !== null ? `<span>피크 ${day.peakHour}시</span>` : ""}
      <span>평균 대비 ${day.vsAvg}배</span>
    </div>
    ${day.headline ? `<p class="recent-day-headline">${escapeHtml(day.headline)}</p>` : ""}
    ${kws ? `<div class="recent-day-kws">${kws}</div>` : ""}
    ${senders ? `<p class="recent-day-senders">주도: ${senders}</p>` : ""}
    ${renderSentimentInlineSmall(day.sentiment)}
    ${renderMiniHourlyBar(day.hourly, day.peakHour)}
    ${day.hotTopicSummary ? `<p class="recent-day-summary">${renderHighlightLine(day.hotTopicSummary)}</p>` : ""}
    ${evidence ? `<ul class="recent-day-evidence">${evidence}</ul>` : ""}
  </article>`;
}

export function renderRecentSnapshot(data: ReportData): string {
  const snap = data.recentSnapshot;
  if (!snap || snap.week.length === 0) return "";

  const weekKws = snap.weekKeywords.slice(0, 6).map((k) => `<span class="recent-day-kw">${escapeHtml(k)}</span>`).join("");
  const summaryHtml = `<div class="recent-week-summary" data-observe>
    <div class="recent-week-stats">
      <span class="recent-week-stat"><strong>${formatNumber(snap.weekTotal)}</strong>건 <small>7일간</small></span>
      <span class="recent-week-stat"><strong>${Math.round(snap.weekTotal / 7)}</strong>건 <small>일평균</small></span>
      <span class="recent-week-stat"><strong>${snap.weekVsOverall}x</strong> <small>전체 대비</small></span>
      <span class="recent-week-stat"><strong>${snap.weekParticipants}</strong>명 <small>참여자</small></span>
    </div>
    ${weekKws ? `<div class="recent-week-kws">주간 키워드: ${weekKws}</div>` : ""}
  </div>`;

  const todayHtml = snap.today ? renderDaySnapshotCard(snap.today, true) : "";
  const weekDays = (snap.today ? snap.week.slice(0, 6) : snap.week).slice(0, 2);
  const weekMore = snap.week.length > weekDays.length ? ` <small>· 최근 ${weekDays.length}일만 표시</small>` : "";
  const dayCardsHtml = weekDays.map((d) => renderDaySnapshotCard(d, false)).join("");

  const sections: string[] = [
    `<section id="s-recent" class="kca-section recent-snapshot-section kca-shot-block kca-shot-block--compact anim-enter" style="--enter-delay:0.035s" aria-label="최근 활동 요약" data-observe>
    <h2 class="llm-strip-title">⏰ 최근 활동 스냅샷</h2>
    <p class="recent-section-hint">리포트 기준 최근 7일 요약이에요. 당일·일별 카드는 아래 섹션에서 이어집니다.</p>
    ${summaryHtml}
  </section>`,
  ];

  if (todayHtml) {
    sections.push(`<section id="s-recent-today" class="kca-section recent-snapshot-section kca-shot-block anim-enter" style="--enter-delay:0.036s" aria-label="리포트 당일" data-observe>
    <h2 class="llm-strip-title">📍 리포트 당일 (24h)</h2>
    ${todayHtml}
  </section>`);
  }

  if (dayCardsHtml) {
    sections.push(`<section id="s-recent-week" class="kca-section recent-snapshot-section kca-shot-block anim-enter" style="--enter-delay:0.037s" aria-label="최근 일별 활동" data-observe>
    <h2 class="llm-strip-title">📅 최근 일별${weekMore}</h2>
    <div class="recent-days-grid recent-days-grid--shot">${dayCardsHtml}</div>
  </section>`);
  }

  return sections.join("\n");
}

function mapSentimentWeather(
  s: { positive: number; negative: number; neutral: number },
  energy?: number,
): { icon: string; cls: string; label: string } {
  const total = Math.max(1, s.positive + s.negative + s.neutral);
  const score = (s.positive - s.negative) / total;
  const isStorm = energy != null && energy < -40 && s.negative > s.positive;
  if (isStorm) {
    return { icon: "⚡", cls: "storm", label: "폭풍" };
  }
  if (score > 0.3) return { icon: "☀️", cls: "sun", label: "맑음" };
  if (score > 0.05) return { icon: "🌤️", cls: "partly-sunny", label: "대체로 맑음" };
  if (score > -0.05) return { icon: "⛅", cls: "cloud", label: "구름" };
  if (score > -0.3) return { icon: "🌥️", cls: "overcast", label: "흐림" };
  return { icon: "🌧️", cls: "rain", label: "비" };
}

/** 최근 7일 감정 흐름을 날씨 아이콘으로 렌더링 */
export function renderSentimentWeatherStrip(data: ReportData): string {
  const sourceDays: Array<{
    date: string;
    sentiment: { positive: number; negative: number; neutral: number };
    energy?: number;
  }> =
    data.recentSnapshot && data.recentSnapshot.week.length >= 3
      ? data.recentSnapshot.week.map((d) => ({ date: d.date, sentiment: d.sentiment }))
      : data.dailySentiment.map((d) => ({ date: d.date, sentiment: d, energy: d.energy }));

  if (sourceDays.length < 3) return "";

  const items = sourceDays
    .slice(-7)
    .map((d) => {
      const w = mapSentimentWeather(d.sentiment, d.energy);
      return `<article class="sww-day" data-observe role="listitem">
        <time datetime="${escapeHtml(d.date)}">${escapeHtml(d.date.slice(5))}</time>
        <span class="sww-icon sww-icon--${w.cls}" aria-label="${w.label}">${w.icon}</span>
        <span class="sww-label">${w.label}</span>
      </article>`;
    })
    .join("");

  return `<section id="s-sentiment-weather" class="kca-section card kca-card--data kca-shot-block sentiment-weather-strip anim-enter" data-observe style="--enter-delay:0.046s" aria-label="감정 날씨">
    <h3 class="insight-sub">🌤️ 감정 날씨</h3>
    <p class="chart-hint">최근 7일 감정 흐름을 날씨 아이콘으로 요약했어요.</p>
    <div class="sww-row" role="list">${items}</div>
  </section>`;
}

/** 반복 문구 + 방 밈을 하나의 타임라인 스트립으로 렌더링 */
export function renderRoomCultureStrip(data: ReportData): string {
  const repeated = data.repeatedPhrases.slice(0, 5).map((r) => ({
    type: "phrase" as const,
    date: r.peakDate ?? "",
    label: r.label,
    count: r.count,
  }));
  const jokes = (data.llmInsights?.insideJokes ?? []).slice(0, 5).map((j) => ({
    type: "joke" as const,
    date: "",
    label: j.label,
    why: j.whyFunny,
  }));
  if (repeated.length === 0 && jokes.length === 0) return "";

  function formatCultureLabel(label: string): string {
    const urlMatch = label.match(/^https?:\/\/([^\/\s]+)(\/\S*)?$/i);
    if (urlMatch) {
      const host = urlMatch[1] ?? "";
      return `<a class="culture-link" href="${escapeHtml(label)}" target="_blank" rel="noopener noreferrer">🔗 ${escapeHtml(host)}</a>`;
    }
    const withLinks = renderHighlightLine(label).replace(
      /(https?:\/\/[^\s<]+)/g,
      (url) => `<a class="culture-link" href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    );
    return withLinks;
  }

  const phraseCards = repeated
    .map(
      (r) =>
        `<article class="culture-card culture-card--phrase" data-observe role="listitem">
          ${r.date ? `<time datetime="${escapeHtml(r.date)}">${escapeHtml(r.date.slice(5))}</time>` : ""}
          <span class="culture-badge">반복</span>
          <span class="culture-label">${formatCultureLabel(r.label)}</span>
          <span class="culture-count">${formatNumber(r.count)}회</span>
        </article>`,
    )
    .join("");

  const jokeCards = jokes
    .map(
      (j) =>
        `<article class="culture-card culture-card--joke" data-observe role="listitem" title="${escapeHtml(j.why)}">
          <span class="culture-badge">밈</span>
          <span class="culture-label">${formatCultureLabel(j.label)}</span>
        </article>`,
    )
    .join("");

  const laughBadge =
    data.pureLaughMessages > 0
      ? `<span class="culture-laugh-badge">😂 ${formatNumber(data.pureLaughMessages)}</span>`
      : "";

  return `<section id="s-culture" class="kca-section card kca-card--data kca-shot-block room-culture-strip anim-enter" data-observe style="--enter-delay:0.061s" aria-label="방 밈 & 반복 문화">
    <h3 class="insight-sub">🎭 방 밈 & 반복 문구 ${laughBadge}</h3>
    <p class="chart-hint">자주 반복된 문구와 방 안에서만 통하는 밈을 타임라인으로 모았어요.</p>
    <div class="culture-scroll" role="list">${phraseCards}${jokeCards}</div>
  </section>`;
}
