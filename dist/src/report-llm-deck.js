import { escapeHtml, formatNumber, renderHighlightLine } from "./report-util.js";
export function hasLlmStoryDeck(data) {
    const ins = data.llmInsights;
    if (!ins)
        return false;
    return Boolean(ins.roomArchetype ||
        (ins.moments?.length ?? 0) > 0 ||
        (ins.episodeCards?.length ?? 0) > 0 ||
        (ins.relationshipBeats?.length ?? 0) > 0 ||
        (ins.characterCards?.length ?? 0) > 0 ||
        (ins.insideJokes?.length ?? 0) > 0 ||
        (ins.dayMicroStories?.length ?? 0) > 0);
}
export function renderLlmArchetypeBanner(data) {
    const arch = data.llmInsights?.roomArchetype;
    if (!arch)
        return "";
    const hasTraits = Array.isArray(arch.traits) && arch.traits.length > 0;
    const traitsHtml = hasTraits
        ? arch.traits
            .map((t) => `<span class="llm-trait-chip"><span class="llm-trait-dot" aria-hidden="true"></span>${escapeHtml(t)}</span>`)
            .join("")
        : "";
    const fallbackHtml = !hasTraits
        ? `<div class="llm-trait-row llm-trait-row--fallback"><span class="llm-trait-chip llm-trait-chip--fallback">${escapeHtml(arch.name)}의 특징적인 대화 패턴</span></div>`
        : "";
    return `<section id="s-archetype" class="kca-section llm-archetype-banner anim-enter" style="--enter-delay:0.025s" aria-label="방 아키타입">
    <p class="llm-archetype-kicker">🎭 이 방의 얼굴</p>
    <h2 class="llm-archetype-name">${escapeHtml(arch.name)}</h2>
    <p class="llm-archetype-desc">${renderHighlightLine(arch.description)}</p>
    ${traitsHtml ? `<div class="llm-trait-row">${traitsHtml}</div>` : fallbackHtml}
  </section>`;
}
export function renderLlmEpisodeStrip(data) {
    const cards = data.llmInsights?.episodeCards;
    if (!cards?.length)
        return "";
    const inner = cards
        .map((c) => `<article class="llm-episode-card" role="listitem">
      <span class="llm-episode-emoji" aria-hidden="true">${escapeHtml(c.emoji)}</span>
      <p class="llm-episode-period">${escapeHtml(c.period)}</p>
      <h3 class="llm-episode-title">${escapeHtml(c.title)}</h3>
      <p class="llm-episode-tagline">${escapeHtml(c.tagline)}</p>
    </article>`)
        .join("");
    return `<section id="s-episodes" class="kca-section llm-episode-strip anim-enter" style="--enter-delay:0.035s" aria-label="시즌 에피소드">
    <h2 class="llm-strip-title">🎬 시즌 에피소드</h2>
    <div class="llm-episode-scroll" role="list">${inner}</div>
  </section>`;
}
export function renderLlmMomentsBlock(data) {
    const ins = data.llmInsights;
    const moments = ins?.moments;
    const hasNarrative = data.narrative.paragraphs.length > 0 || Boolean(ins);
    if (!hasNarrative)
        return "";
    const paras = data.narrative.paragraphs
        .map((p) => `<p class="narrative-p">${renderHighlightLine(p)}</p>`)
        .join("");
    const momentCards = (moments ?? [])
        .map((m) => `<article class="llm-moment-card" role="listitem">
      <h3>${renderHighlightLine(m.headline)}</h3>
      <p class="llm-moment-ref">${escapeHtml(m.statRef)}</p>
    </article>`)
        .join("");
    const hint = data.summary.usedLlmAnalysis
        ? "통계·키워드를 입력한 <strong>로컬 LLM</strong>이 보강(원문 미포함)."
        : "규칙·통계만으로 만든 요약.";
    return `<section id="s-narrative" class="kca-section card kca-card--story narrative-card anim-enter" style="--enter-delay:0.04s" aria-label="방 이야기">
    <h2 class="section-glow">② 방 이야기</h2>
    <p class="chart-hint">${hint}</p>
    <div class="narrative-body">${paras}</div>
    ${momentCards ? `<div class="llm-moments-grid" role="list">${momentCards}</div>` : ""}
    ${renderLlmDeckExtras(ins)}
  </section>`;
}
function renderLlmDeckExtras(ins) {
    if (!ins)
        return "";
    // insightBullets가 배열이 아닐 수 있음 (방어적 처리)
    const rawBullets = Array.isArray(ins.insightBullets) ? ins.insightBullets : [];
    const bullets = rawBullets
        .filter((b) => typeof b === "string" && b.trim().length > 0 && b !== "insightBullets")
        .map((b) => `<li>${renderHighlightLine(b)}</li>`)
        .join("");
    const proposals = (ins.topicProposals ?? [])
        .map((p) => `<li><strong>${escapeHtml(p.title)}</strong> — ${p.terms.map((t) => escapeHtml(t)).join(", ")}</li>`)
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
    if (!parts.length)
        return "";
    return `<div class="llm-insights" style="margin-top:12px">${parts.join("")}</div>`;
}
export function renderLlmRelationshipBeats(data) {
    const beats = data.llmInsights?.relationshipBeats;
    if (!beats?.length)
        return "";
    const rows = beats
        .map((b) => `<li class="llm-beat-card"><strong>${escapeHtml(b.pair)}</strong>${b.role ? ` <em>${escapeHtml(b.role)}</em>` : ""}<span>${renderHighlightLine(b.beat)}</span></li>`)
        .join("");
    return `<div class="llm-rel-beats"><h3 class="insight-sub">💕 관계 드라마</h3><ul class="llm-beat-list">${rows}</ul></div>`;
}
export function renderLlmCharacterCards(data) {
    const cards = data.llmInsights?.characterCards;
    if (!cards?.length)
        return "";
    const inner = cards
        .map((c) => `<article class="llm-char-card" role="listitem">
      <h3>${escapeHtml(c.alias)}</h3>
      <p>${escapeHtml(c.tagline)}</p>
      <span class="llm-char-stat">${escapeHtml(c.statHook)}</span>
    </article>`)
        .join("");
    return `<section id="s-characters" class="kca-section llm-char-grid anim-enter" style="--enter-delay:0.042s" aria-label="캐릭터 카드">
    <h2 class="llm-strip-title">👥 캐릭터 카드</h2>
    <div class="llm-char-row" role="list">${inner}</div>
  </section>`;
}
export function renderLlmInsideJokes(data) {
    const jokes = data.llmInsights?.insideJokes;
    if (!jokes?.length)
        return "";
    const chips = jokes
        .map((j) => `<span class="llm-meme-chip" title="${escapeHtml(j.whyFunny)}">${escapeHtml(j.label)}</span>`)
        .join("");
    return `<div class="llm-meme-row" aria-label="방 밈"><h3 class="insight-sub">방 밈</h3><div class="llm-meme-chips">${chips}</div></div>`;
}
export function renderLlmEraLabels(data) {
    const eras = data.llmInsights?.eraLabels;
    if (!eras?.length)
        return "";
    const rows = eras
        .map((e) => `<li><strong>${escapeHtml(e.label)}</strong><span>${escapeHtml(e.detail)}</span></li>`)
        .join("");
    return `<div class="llm-era-labels"><h3 class="insight-sub">⏳ 키워드 시대</h3><ul>${rows}</ul></div>`;
}
export function renderLlmDayMicroStories(data) {
    const days = data.llmInsights?.dayMicroStories;
    if (!days?.length)
        return "";
    const rows = days
        .map((d) => `<li><time datetime="${escapeHtml(d.date)}">${escapeHtml(d.date)}</time> ${renderHighlightLine(d.line)}</li>`)
        .join("");
    return `<div class="llm-day-stories"><h3 class="insight-sub">그날의 방</h3><ul>${rows}</ul></div>`;
}
export function renderDailyHotTopics(data) {
    const topics = data.dailyHotTopics;
    if (!topics?.length)
        return "";
    const burstSet = new Set(data.burstDays.map((d) => d.date));
    const maxMsg = Math.max(...topics.map((t) => t.messageCount), 1);
    const rows = topics
        .map((t) => {
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
        <h3 class="hot-topic-title">${escapeHtml(t.title ?? "대화 흐름")}</h3>
        ${keywords ? `<div class="hot-topic-kws">${keywords}</div>` : ""}
        <p class="hot-topic-summary">${escapeHtml(t.summary)}</p>
        ${evidence ? `<ul class="hot-topic-evidence">${evidence}</ul>` : ""}
        <div class="hot-topic-bar"><div class="hot-topic-bar-fill" style="width:${barW}%"></div></div>
        <div class="hot-topic-footer">
          <span class="hot-topic-count">${t.messageCount}건${lift}</span>
          ${participants ? `<span class="hot-topic-participants">주도: ${escapeHtml(participants)}</span>` : ""}
        </div>
      </article>`;
    })
        .join("");
    return `<section id="s-hot-topics" class="kca-section hot-topics-section anim-enter" style="--enter-delay:0.045s" aria-label="이 날의 핫토픽">
    <h2 class="llm-strip-title">이 날의 핫토픽</h2>
    <div class="hot-topics-grid" role="list">${rows}</div>
  </section>`;
}
export function renderLlmShareFooter(data) {
    const ins = data.llmInsights;
    if (!ins?.shareLine && !(ins?.hashtags?.length) && !(ins?.counterfactuals?.length))
        return "";
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
export function renderParticipantRoles(data) {
    const roles = data.participantRoles;
    if (!roles || roles.length === 0)
        return "";
    const roleEmoji = {
        주도형: "👑",
        긴글러: "✍️",
        "분위기 메이커": "😂",
        리액션러: "⚡",
        "자료 공유자": "🔗",
        "첨부 장인": "🖼️",
        "심야 상주자": "🌙",
        "연속 발화자": "📣",
    };
    const roleDesc = {
        주도형: "흐름 주도",
        긴글러: "맥락 설명",
        "분위기 메이커": "웃음 신호",
        리액션러: "빠른 반응",
        "자료 공유자": "링크 큐레이터",
        "첨부 장인": "시각 자료",
        "심야 상주자": "늦은 시간 활동",
        "연속 발화자": "긴 흐름 유지",
    };
    const cards = roles
        .map((r) => {
        const emoji = roleEmoji[r.role] ?? "💬";
        const desc = roleDesc[r.role] ?? r.role;
        return `<article class="participant-role-card" role="listitem" data-role="${escapeHtml(r.role)}">
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
    return `<section id="s-participant-roles" class="kca-section participant-roles-section anim-enter" style="--enter-delay:0.03s" aria-label="참여자 역할">
    <h2 class="llm-strip-title">참여자 역할</h2>
    <div class="participant-roles-grid" role="list">${cards}</div>
  </section>`;
}
export function renderMemorableMoments(data) {
    const moments = data.memorableMoments;
    if (!moments || moments.length === 0)
        return "";
    const TYPE_ICONS = {
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
        return `<li class="moment-item">
        <time datetime="${escapeHtml(m.date)}">${escapeHtml(m.date)}</time>
        <span class="moment-icon" aria-hidden="true">${icon}</span>
        <div class="moment-body">
          <strong class="moment-title">${escapeHtml(m.title)}</strong>
          <span class="moment-desc">${escapeHtml(m.description)}</span>
          ${evidenceHtml}
          ${keywordsHtml}
        </div>
      </li>`;
    })
        .join("");
    return `<section id="s-memorable-moments" class="kca-section memorable-moments-section anim-enter" style="--enter-delay:0.04s" aria-label="기억에 남는 순간">
    <h2 class="llm-strip-title">기억에 남는 순간</h2>
    <ul class="moments-list">${items}</ul>
  </section>`;
}
// ── 최근 7일 + 리포트 당일 스냅샷 ──
/** 0~23시간 분포를 CSS 전용 미니 바 차트로 렌더링 */
function renderMiniHourlyBar(hourly, highlightHour) {
    const max = Math.max(...hourly, 1);
    const bars = hourly
        .map((count, h) => {
        const pct = Math.round((count / max) * 100);
        const hl = h === highlightHour ? " recent-hourly-bar__seg--peak" : "";
        return `<span class="recent-hourly-bar__seg${hl}" style="--h:${pct}%" title="${h}시: ${count}건"></span>`;
    })
        .join("");
    return `<div class="recent-hourly-bar" aria-label="시간대 분포">${bars}</div>`;
}
/** 감정 비율을 인라인 바로 렌더링 */
function renderSentimentInlineSmall(s) {
    return `<span class="recent-sentiment-bar" title="긍정 ${s.positive}% · 부정 ${s.negative}% · 중립 ${s.neutral}%">
    <span class="recent-sentiment-bar__pos" style="width:${s.positive}%"></span>
    <span class="recent-sentiment-bar__neg" style="width:${s.negative}%"></span>
  </span>`;
}
/** 하루 스냅샷 카드 */
function renderDaySnapshotCard(day, isToday) {
    const cls = isToday ? "recent-day-card recent-day-card--today" : "recent-day-card";
    const label = isToday ? "📍 리포트 당일" : day.date;
    const kws = day.keywords.slice(0, 4).map((k) => `<span class="recent-day-kw">${escapeHtml(k)}</span>`).join("");
    const senders = day.topSenders.slice(0, 3).map((s) => `${escapeHtml(s.alias)}(${s.count})`).join(" · ");
    const evidence = (day.evidence ?? []).slice(0, 2).map((e) => `<li>${escapeHtml(e)}</li>`).join("");
    return `<article class="${cls}">
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
    ${kws ? `<div class="recent-day-kws">${kws}</div>` : ""}
    ${senders ? `<p class="recent-day-senders">주도: ${senders}</p>` : ""}
    ${renderSentimentInlineSmall(day.sentiment)}
    ${renderMiniHourlyBar(day.hourly, day.peakHour)}
    ${day.hotTopicSummary ? `<p class="recent-day-summary">${escapeHtml(day.hotTopicSummary)}</p>` : ""}
    ${evidence ? `<ul class="recent-day-evidence">${evidence}</ul>` : ""}
  </article>`;
}
export function renderRecentSnapshot(data) {
    const snap = data.recentSnapshot;
    if (!snap || snap.week.length === 0)
        return "";
    // 주간 요약
    const weekKws = snap.weekKeywords.slice(0, 6).map((k) => `<span class="recent-day-kw">${escapeHtml(k)}</span>`).join("");
    const summaryHtml = `<div class="recent-week-summary">
    <div class="recent-week-stats">
      <span class="recent-week-stat"><strong>${formatNumber(snap.weekTotal)}</strong>건 <small>7일간</small></span>
      <span class="recent-week-stat"><strong>${Math.round(snap.weekTotal / 7)}</strong>건 <small>일평균</small></span>
      <span class="recent-week-stat"><strong>${snap.weekVsOverall}x</strong> <small>전체 대비</small></span>
      <span class="recent-week-stat"><strong>${snap.weekParticipants}</strong>명 <small>참여자</small></span>
    </div>
    ${weekKws ? `<div class="recent-week-kws">주간 키워드: ${weekKws}</div>` : ""}
  </div>`;
    // 리포트 당일 카드 (크게)
    const todayHtml = snap.today ? renderDaySnapshotCard(snap.today, true) : "";
    // 7일 일별 카드 (오늘 제외한 6일)
    const weekDays = snap.today ? snap.week.slice(0, 6) : snap.week;
    const dayCardsHtml = weekDays.map((d) => renderDaySnapshotCard(d, false)).join("");
    return `<section id="s-recent" class="kca-section recent-snapshot-section anim-enter" style="--enter-delay:0.035s" aria-label="최근 활동 스냅샷">
    <h2 class="llm-strip-title">⏰ 최근 활동 스냅샷</h2>
    <p class="recent-section-hint">리포트 기준 최근 7일간 활동이에요. 최근일수록 기억에 많이 남으니 자세히 봐요.</p>
    ${summaryHtml}
    ${todayHtml ? `<h3 class="recent-today-heading">리포트 당일 (24h)</h3>${todayHtml}` : ""}
    <h3 class="recent-week-heading">최근 7일</h3>
    <div class="recent-days-grid">${dayCardsHtml}</div>
  </section>`;
}
//# sourceMappingURL=report-llm-deck.js.map