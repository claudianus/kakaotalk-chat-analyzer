const FIVE_MIB = 5 * 1024 * 1024;
export function renderReportHtml(data) {
    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>카카오톡 대화 리포트 · kca</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f1ea;
      --bg2: #e8e2d6;
      --ink: #141a1f;
      --muted: #5c6670;
      --line: #d4cdc2;
      --panel: #fffcf7;
      --accent: #0f6b5c;
      --accent2: #c45c2a;
      --gold: #b8860b;
      --shadow: 0 18px 50px rgba(20, 26, 31, 0.08);
      --bar-bg: #e5dfd4;
      --glow: rgba(15, 107, 92, 0.18);
      font-family: "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", ui-sans-serif, system-ui, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        --bg: #070a0e;
        --bg2: #0e1218;
        --ink: #e9eef5;
        --muted: #8b98a8;
        --line: rgba(255, 255, 255, 0.1);
        --panel: rgba(255, 255, 255, 0.045);
        --accent: #3ee8c5;
        --accent2: #ff9f43;
        --gold: #fbbf24;
        --shadow: 0 28px 90px rgba(0, 0, 0, 0.55);
        --bar-bg: rgba(255, 255, 255, 0.08);
        --glow: rgba(62, 232, 197, 0.15);
      }
    }
    :root[data-theme="dark"] {
      --bg: #070a0e;
      --bg2: #0e1218;
      --ink: #e9eef5;
      --muted: #8b98a8;
      --line: rgba(255, 255, 255, 0.1);
      --panel: rgba(255, 255, 255, 0.045);
      --accent: #3ee8c5;
      --accent2: #ff9f43;
      --gold: #fbbf24;
      --shadow: 0 28px 90px rgba(0, 0, 0, 0.55);
      --bar-bg: rgba(255, 255, 255, 0.08);
      --glow: rgba(62, 232, 197, 0.15);
    }
    :root[data-theme="light"] {
      --bg: #f4f1ea;
      --bg2: #e8e2d6;
      --ink: #141a1f;
      --muted: #5c6670;
      --line: #d4cdc2;
      --panel: #fffcf7;
      --accent: #0f6b5c;
      --accent2: #c45c2a;
      --gold: #b8860b;
      --shadow: 0 18px 50px rgba(20, 26, 31, 0.08);
      --bar-bg: #e5dfd4;
      --glow: rgba(15, 107, 92, 0.18);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    #s-facts, #s-story, #s-hl, #s-ai, #s-charts, #s-help { scroll-margin-top: 76px; }
    .skip-link {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .skip-link:focus {
      position: fixed;
      left: 12px;
      top: 12px;
      width: auto;
      height: auto;
      margin: 0;
      clip: auto;
      z-index: 10000;
      padding: 10px 14px;
      border-radius: 10px;
      background: var(--accent);
      color: #04120f;
      font-weight: 800;
      font-size: 13px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    }
    .deck-nav {
      position: sticky;
      top: 0;
      z-index: 30;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
      margin-bottom: 14px;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    }
    .deck-nav-h {
      font-size: 11px;
      font-weight: 800;
      color: var(--muted);
      margin-right: 4px;
      letter-spacing: 0.04em;
    }
    .deck-nav a {
      font-size: 12px;
      font-weight: 700;
      padding: 6px 11px;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--ink);
      text-decoration: none;
      transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
    }
    .deck-nav a:hover {
      border-color: var(--accent);
      background: rgba(62, 232, 197, 0.08);
      transform: translateY(-1px);
    }
    @keyframes kca-fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes kca-ring-in {
      from { transform: scale(0.92); opacity: 0.75; }
      to { transform: scale(1); opacity: 1; }
    }
    .anim-enter {
      animation: kca-fade-up 0.52s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      opacity: 0;
      animation-delay: var(--enter-delay, 0s);
    }
    .rh-wrap.anim-ring { animation: kca-ring-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: var(--shadow);
      transition: box-shadow 0.22s ease, transform 0.22s ease, border-color 0.2s ease;
    }
    .card:hover {
      border-color: var(--accent);
      box-shadow: 0 22px 56px rgba(20, 26, 31, 0.11);
      transform: translateY(-2px);
    }
    :root[data-theme="dark"] .card:hover {
      box-shadow: 0 28px 72px rgba(0, 0, 0, 0.45);
    }
    .fact-hero-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin: 0 0 14px;
    }
    @media (max-width: 560px) { .fact-hero-strip { grid-template-columns: 1fr; } }
    .fact-hero-cell {
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: linear-gradient(145deg, rgba(15, 107, 92, 0.08), transparent);
    }
    .fact-hero-cell b {
      display: block;
      font-size: 11px;
      font-weight: 750;
      color: var(--muted);
      margin-bottom: 4px;
      letter-spacing: 0.02em;
    }
    .fact-hero-cell span {
      font-size: clamp(22px, 4vw, 28px);
      font-weight: 900;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--ink);
    }
    .glossary {
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
      font-size: 13px;
      line-height: 1.55;
      color: var(--muted);
    }
    .glossary > summary {
      cursor: pointer;
      font-weight: 800;
      color: var(--ink);
      list-style: none;
    }
    .glossary > summary::-webkit-details-marker { display: none; }
    .glossary dl { margin: 12px 0 0; display: grid; gap: 10px; }
    .glossary dt { font-weight: 750; color: var(--ink); font-size: 12px; }
    .glossary dd { margin: 2px 0 0; padding: 0; font-size: 12px; }
    .chart-stack { display: flex; flex-direction: column; gap: 14px; }
    .anim-enter:target {
      opacity: 1 !important;
      transform: none !important;
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .anim-enter, .rh-wrap.anim-ring { animation: none !important; opacity: 1 !important; transform: none !important; }
      .card { transition: none; }
      .card:hover { transform: none; }
    }
    body {
      margin: 0;
      background:
        radial-gradient(1000px 520px at 12% -8%, var(--glow), transparent 55%),
        radial-gradient(800px 420px at 92% 0%, rgba(196, 92, 42, 0.12), transparent 45%),
        linear-gradient(180deg, var(--bg), var(--bg2));
      color: var(--ink);
      transition: background 0.28s ease, color 0.2s ease;
    }
    main { width: min(1200px, calc(100% - 36px)); margin: 0 auto; padding: 36px 0 56px; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 18px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: var(--shadow);
    }
    .toolbar-label { font-size: 12px; font-weight: 700; color: var(--muted); margin-right: 4px; }
    .theme-btn {
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      padding: 7px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: transparent;
      color: var(--ink);
      cursor: pointer;
    }
    .theme-btn:hover { border-color: var(--accent); color: var(--accent); }
    .hero { display: grid; gap: 20px; grid-template-columns: 1.35fr 1fr; align-items: stretch; padding-bottom: 28px; }
    h1 { margin: 0; font-size: clamp(28px, 4.2vw, 48px); line-height: 1.08; letter-spacing: -0.03em; font-weight: 800; }
    .sub { margin: 12px 0 0; color: var(--muted); line-height: 1.65; font-size: 15px; max-width: 52ch; }
    .badge-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .badge { font-size: 12px; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--muted); }
    .side-card { display: flex; flex-direction: column; gap: 10px; justify-content: center; }
    .side-card p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
    .side-card strong { color: var(--ink); }
    h2 { margin: 0 0 12px; font-size: 17px; font-weight: 750; letter-spacing: -0.02em; }
    .grid { display: grid; gap: 14px; }
    .two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .highlights { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .highlights li { padding: 12px 14px; border-radius: 10px; background: linear-gradient(120deg, rgba(15,107,92,0.08), rgba(196,92,42,0.06)); border: 1px solid rgba(15,107,92,0.15); font-size: 14px; line-height: 1.55; }
    .highlights strong { color: var(--accent); font-weight: 750; }
    .bars { display: grid; gap: 8px; }
    .bar-row { display: grid; grid-template-columns: minmax(72px, 1fr) minmax(0, 2.2fr) 52px; gap: 10px; align-items: center; min-height: 22px; }
    .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .bar-track { height: 9px; background: var(--bar-bg); border-radius: 999px; overflow: hidden; }
    .bar-fill {
      display: block;
      height: 100%;
      min-width: 2px;
      background: linear-gradient(90deg, var(--accent), #1a9d87);
      border-radius: inherit;
    }
    .bar-value { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; font-size: 12px; }
    .chart-hint { margin: 0 0 10px; font-size: 12px; color: var(--muted); line-height: 1.45; }
    .chart-hint strong { color: var(--ink); font-weight: 700; }
    .calendar-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; margin: 0 -2px; }
    .calendar {
      display: grid;
      gap: 4px;
      width: max-content;
      max-width: 100%;
      box-sizing: border-box;
    }
    .day {
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-width: 42px;
      min-height: 46px;
      padding: 4px 3px;
      font-weight: 650;
      border: 1px solid var(--line);
    }
    .day-k { font-size: 10px; line-height: 1.15; font-weight: 750; letter-spacing: -0.02em; }
    .day-n { font-size: 12px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; }
    .hours-wrap { display: flex; flex-direction: column; gap: 0; }
    .hours-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; margin: 0 -2px; }
    .hours-chart-inner { min-width: 520px; display: flex; flex-direction: column; gap: 5px; }
    .hours-bars { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; align-items: end; height: 140px; }
    .hour {
      min-width: 0;
      width: 100%;
      align-self: end;
      background: linear-gradient(180deg, var(--accent2), #e07a45);
      border-radius: 3px 3px 0 0;
    }
    .hours-labels {
      display: grid;
      grid-template-columns: repeat(24, 1fr);
      gap: 2px;
      font-size: 9px;
      line-height: 1.15;
      color: var(--muted);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .hours-labels span { min-width: 0; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th, .table td { text-align: left; border-bottom: 1px solid var(--line); padding: 9px 6px; }
    .table th { color: var(--muted); font-weight: 650; font-size: 11px; text-transform: none; }
    .table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .self-serve {
      margin-top: 14px;
      border: 1px dashed rgba(15, 107, 92, 0.38);
      border-radius: 12px;
      padding: 16px 18px;
      background: linear-gradient(135deg, rgba(15, 107, 92, 0.06), rgba(196, 92, 42, 0.04));
      font-size: 13px;
      line-height: 1.6;
      color: var(--muted);
    }
    .self-serve h2 { margin: 0 0 10px; font-size: 16px; font-weight: 750; color: var(--ink); letter-spacing: -0.02em; }
    .self-serve p { margin: 0 0 8px; }
    .self-serve ol { margin: 0 0 10px; padding-left: 1.25rem; }
    .self-serve li { margin: 4px 0; }
    .self-serve code { font-size: 11.5px; background: var(--bar-bg); padding: 1px 5px; border-radius: 4px; color: var(--ink); }
    .self-serve .cmd {
      margin: 10px 0 12px;
      padding: 11px 13px;
      border-radius: 8px;
      background: var(--bar-bg);
      border: 1px solid var(--line);
      font-family: ui-monospace, "Cascadia Code", "Consolas", monospace;
      font-size: 12px;
      line-height: 1.45;
      color: var(--ink);
      overflow-x: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .self-serve .links { margin: 10px 0 0; font-size: 12px; }
    .self-serve .links a { font-weight: 650; }
    .insight-hero { position: relative; overflow: hidden; }
    .insight-hero::before {
      content: "";
      position: absolute;
      inset: -40% 40% auto -20%;
      height: 120%;
      background: radial-gradient(closest-side, var(--glow), transparent 70%);
      pointer-events: none;
    }
    .insight-head { display: flex; flex-wrap: wrap; gap: 20px; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
    .insight-lede { margin: 8px 0 0; color: var(--muted); font-size: 14px; line-height: 1.65; max-width: 62ch; }
    .insight-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
      position: relative;
      z-index: 1;
    }
    @media (min-width: 1080px) {
      .insight-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) { .insight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .ins-metric {
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: linear-gradient(145deg, rgba(255,255,255,0.04), transparent);
    }
    .ins-m-label { display: block; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    .ins-m-val { font-size: 22px; font-weight: 850; letter-spacing: -0.03em; line-height: 1.1; }
    .ins-m-sub { display: block; font-size: 11px; color: var(--muted); margin-top: 6px; }
    .insight-split { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 22px; position: relative; z-index: 1; }
    @media (max-width: 900px) { .insight-split { grid-template-columns: 1fr; } }
    .insight-sub { margin: 0 0 6px; font-size: 14px; font-weight: 750; color: var(--ink); }
    .daypart-bar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; border: 1px solid var(--line); }
    .dp-seg { min-width: 2px; height: 100%; transition: opacity 0.2s; }
    .dp-seg:hover { opacity: 0.85; }
    .daypart-legend { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px 16px; font-size: 12px; color: var(--muted); }
    .daypart-legend li { display: flex; align-items: center; gap: 6px; }
    .daypart-legend i { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .rh-wrap { position: relative; width: 108px; height: 108px; flex-shrink: 0; }
    .rh-ring {
      width: 108px;
      height: 108px;
      border-radius: 50%;
      background: conic-gradient(from -90deg, var(--accent) calc(var(--p) * 1%), var(--bar-bg) 0);
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 1px var(--line) inset;
    }
    .rh-ring span {
      width: 74px;
      height: 74px;
      border-radius: 50%;
      background: var(--panel);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid var(--line);
    }
    .rh-cap {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      font-size: 11px;
      color: var(--muted);
      font-weight: 700;
    }
    .rh-cap span { font-size: 22px; font-weight: 900; color: var(--ink); letter-spacing: -0.04em; }
    .rh-cap small { font-size: 11px; font-weight: 700; color: var(--muted); margin-left: 1px; }
    .sc-plot {
      position: relative;
      height: 200px;
      border-radius: 12px;
      border: 1px dashed var(--line);
      background: linear-gradient(180deg, rgba(0,0,0,0.02), transparent);
      margin-top: 4px;
    }
    .sc-dot {
      position: absolute;
      width: 12px;
      height: 12px;
      margin-left: -6px;
      margin-top: -6px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--panel), 0 4px 12px rgba(0, 0, 0, 0.18);
      cursor: default;
    }
    .sc-axis { position: absolute; font-size: 10px; color: var(--muted); font-weight: 650; }
    .sc-x { right: 8px; bottom: 6px; }
    .sc-y { left: 8px; top: 8px; }
    .fact-card { margin-bottom: 14px; padding: 14px 16px; }
    .fact-card h2 { margin: 0 0 6px; font-size: 15px; }
    .fact-hint { margin: 0 0 10px; font-size: 11px; color: var(--muted); line-height: 1.45; }
    .fact-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
      gap: 5px 7px;
    }
    .fact-cell {
      padding: 5px 7px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.04), transparent);
      min-height: 42px;
    }
    .fact-cell b {
      display: block;
      color: var(--muted);
      font-size: 9px;
      font-weight: 750;
      letter-spacing: 0.03em;
      line-height: 1.15;
      margin-bottom: 2px;
    }
    .fact-cell span {
      font-weight: 850;
      font-size: 12.5px;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    footer { margin-top: 28px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    @media (max-width: 900px) {
      .hero, .two, .three { grid-template-columns: 1fr; }
      .hours-chart-inner { min-width: 480px; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#s-facts" data-kca-jump="s-facts">숫자 요약으로 건너뛰기</a>
  <main>
    <div class="toolbar anim-enter" role="toolbar" aria-label="표시 테마" style="--enter-delay:0s">
      <span class="toolbar-label">테마</span>
      <button type="button" class="theme-btn" data-theme-set="light">라이트</button>
      <button type="button" class="theme-btn" data-theme-set="dark">다크</button>
      <button type="button" class="theme-btn" data-theme-set="system">시스템</button>
    </div>
    ${renderSectionNav(data)}
    ${renderFactMatrix(data)}
    <header id="s-story" class="hero anim-enter" style="--enter-delay:0.04s">
      <div>
        <h1>카카오톡 대화 리포트</h1>
        <p class="sub">원문 내용·전체 링크 주소는 저장하지 않아요. 이름은 <strong>일부만 보이게 가린 표시명</strong>이에요. 위쪽 <strong>① 숫자 요약</strong>에서 한눈에 보고, 아래 차트로 패턴을 따라가면 됩니다.</p>
        <div class="badge-row">
          <span class="badge">프라이버시: ${escapeHtml(privacyLabel(data.privacy))}</span>
          <span class="badge">인코딩: ${escapeHtml(data.source.encoding)}</span>
          <span class="badge">경고: ${data.source.warnings}건</span>
        </div>
      </div>
      <div class="card side-card">
        <p><strong>생성 시각</strong><br>${escapeHtml(formatTimestamp(data.generatedAt))}</p>
        <p><strong>첫 메시지</strong><br>${escapeHtml(data.summary.firstMessage ?? "—")}</p>
        <p><strong>마지막 메시지</strong><br>${escapeHtml(data.summary.lastMessage ?? "—")}</p>
      </div>
    </header>

    ${data.highlights.length > 0
        ? `<section id="s-hl" class="card anim-enter" style="margin-bottom:16px;--enter-delay:0.05s"><h2>하이라이트</h2><p class="chart-hint" style="margin-top:-4px">대화에서 눈에 띈 <strong>짧은 요약</strong>이에요. 아래 차트와 같이 보면 맥락이 잡힙니다.</p><ul class="highlights">${data.highlights.map((h) => `<li>${renderHighlightLine(h)}</li>`).join("")}</ul></section>`
        : ""}

    ${renderInsightDeck(data)}

    <div id="s-charts" class="chart-stack anim-enter" style="--enter-delay:0.06s">
    <section class="grid two" style="margin-bottom:14px">
      ${panel("일별 활동 히트맵", "날짜마다 메시지가 얼마나 쌓였는지 색으로 보여요.", renderDaily(data.daily))}
      ${panel("시간대 리듬 (0~23시)", "하루 중 몇 시에 가장 붐비는지 막대로 확인해요.", renderHours(data.hourly))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("참여자 랭킹", "누가 얼마나 보냈는지 비율과 평균 길이를 함께 봐요.", renderParticipants(data.participants))}
      ${panel("요일별 활동", "주중·주말 패턴이 한눈에 들어옵니다.", renderCountBars(data.weekdays))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("월별 추이", "기간이 길 때 계절·이벤트 구간을 가늠할 때 씁니다.", renderMonthly(data.monthly))}
      ${panel("첨부 유형", "사진·동영상 등 메타 유형 비중이에요.", renderCountBars(data.attachments))}
    </section>

    <section class="grid two" style="margin-bottom:14px">
      ${panel("자주 나온 도메인", "공유 링크의 사이트 이름 일부만 집계했어요.", renderCountBars(data.domains))}
      ${panel("키워드 스냅샷", "자주 등장한 단어 상위 목록이에요.", renderCountBars(data.keywords))}
    </section>
    </div>

    ${renderSelfServeCallout()}
    ${renderHelpGlossary()}

    <script>
    (function () {
      var KEY = "kca-report-theme";
      var root = document.documentElement;
      function apply(v) {
        if (v === "system" || !v) {
          root.removeAttribute("data-theme");
          try {
            localStorage.removeItem(KEY);
          } catch (e) {}
        } else {
          root.setAttribute("data-theme", v);
          try {
            localStorage.setItem(KEY, v);
          } catch (e) {}
        }
      }
      try {
        var s = localStorage.getItem(KEY);
        if (s === "dark" || s === "light") root.setAttribute("data-theme", s);
      } catch (e) {}
      document.querySelectorAll(".theme-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          apply(btn.getAttribute("data-theme-set") || "system");
        });
      });
    })();
    </script>
    <script>
    (function () {
      var reduce = false;
      try {
        reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}
      function jumpTo(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }
      document.querySelectorAll("[data-kca-jump]").forEach(function (link) {
        link.addEventListener("click", function (ev) {
          var id = link.getAttribute("data-kca-jump");
          if (!id || !document.getElementById(id)) return;
          ev.preventDefault();
          jumpTo(id);
        });
      });
      var initial = (location.hash || "").replace(/^#/, "");
      if (initial && document.getElementById(initial)) {
        try {
          history.replaceState(null, "", location.pathname + location.search);
        } catch (e) {}
        requestAnimationFrame(function () {
          jumpTo(initial);
        });
      }
    })();
    </script>

    <script type="application/json" id="report-data">${escapeJsonForHtml(data)}</script>
    <footer>${escapeHtml(data.source.fileName)} · 경고 ${data.source.warnings}건 · 본 리포트는 통계·참고용이며 법적·회계적 증빙으로 쓸 수 없습니다 · <span title="HTML 단일 파일">kca 리포트</span></footer>
  </main>
</body>
</html>`;
    const size = Buffer.byteLength(html, "utf8");
    if (size > FIVE_MIB) {
        throw new Error(`Generated HTML is ${size} bytes, which exceeds the 5 MiB BrewPage HTML limit.`);
    }
    return html;
}
function renderSectionNav(data) {
    const hl = data.highlights.length > 0 ? `<a href="#s-hl" data-kca-jump="s-hl">하이라이트</a>` : "";
    return `<nav class="deck-nav anim-enter" aria-label="섹션 바로가기" style="--enter-delay:0.02s">
    <span class="deck-nav-h">빠른 이동</span>
    <a href="#s-facts" data-kca-jump="s-facts">① 숫자 요약</a>
    <a href="#s-story" data-kca-jump="s-story">② 이 리포트 안내</a>
    ${hl}
    <a href="#s-ai" data-kca-jump="s-ai">③ 분위기·리듬</a>
    <a href="#s-charts" data-kca-jump="s-charts">④ 차트 모아보기</a>
    <a href="#s-help" data-kca-jump="s-help">⑤ 용어 설명</a>
  </nav>`;
}
function renderHelpGlossary() {
    return `<section id="s-help" class="glossary anim-enter" aria-label="용어 설명" style="--enter-delay:0.08s">
    <details>
      <summary>용어가 낯설 때 — 한 번에 펼쳐보기</summary>
      <dl>
        <dt>Gini (지니)</dt><dd>참여가 얼마나 한쪽에 쏠렸는지 0~1에 가까운 숫자예요. 0에 가까우면 비슷하게 나눠 말하고, 높을수록 소수가 더 많이 말한 편이에요.</dd>
        <dt>P90 간격</dt><dd>메시지 사이 시간 간격을 작은 순으로 줄 세웠을 때, 위에서 10% 지점(느린 쪽) 값이에요. “가끔 아주 느린 응답”이 있는지 볼 때 씁니다.</dd>
        <dt>CV (변동계수)</dt><dd>간격이 들쭉날쭉한 정도예요. 숫자가 크면 리듬이 불규칙한 편입니다.</dd>
        <dt>도메인 H (엔트로피)</dt><dd>공유한 링크가 몇 종류 사이트로 퍼져 있는지 “다양함”을 bit 단위로 요약한 값이에요. 높을수록 여러 종류의 사이트가 나온 거예요.</dd>
        <dt>리듬 점수</dt><dd>활동일·메시지 밀도·시간대 분산 등을 섞은 내부 요약 점수(0~100)로, “이 방이 얼마나 꾸준히 살아 있는지” 감으로 보기 위한 지표입니다.</dd>
        <dt>화자 전환 (100메시지당)</dt><dd>말하는 사람이 바뀐 횟수를 메시지 100개당으로 나눈 거예요. 숫자가 클수록 빠르게 교대하며 대화하는 스타일에 가깝습니다.</dd>
      </dl>
    </details>
  </section>`;
}
function renderFactMatrix(data) {
    const s = data.summary;
    const ins = data.insights;
    const cells = [
        ["총 메시지", formatNumber(s.totalMessages)],
        ["참여자", formatNumber(s.participants)],
        ["활동일", formatNumber(s.activeDays)],
        ["활동일당", String(s.messagesPerActiveDay)],
        ["캘린더 밀도", ins.densityMessagesPerCalendarDay === null ? "—" : String(ins.densityMessagesPerCalendarDay)],
        ["링크·100", String(ins.linksPer100)],
        ["첨부·100", String(ins.attachmentsPer100)],
        ["사진÷첨부%", ins.photoShareOfAllAttachmentMarkers === null ? "—" : `${ins.photoShareOfAllAttachmentMarkers}%`],
        ["참여 중앙값", ins.medianMessagesPerParticipant === null ? "—" : String(ins.medianMessagesPerParticipant)],
        ["리듬 점수", `${ins.rhythmScore}/100`],
        ["주말%", `${ins.weekendSharePercent}%`],
        ["심야%", `${s.nightSharePercent}%`],
        ["1분내 응답%", ins.burstGapUnder1mPercent === null ? "—" : `${ins.burstGapUnder1mPercent}%`],
        ["60분+ 간격%", ins.gapOver60mPercent === null ? "—" : `${ins.gapOver60mPercent}%`],
        ["독백3+%", `${ins.monologueMessagesPercent}%`],
        ["간격 중앙", s.medianReplyGapMinutes === null ? "—" : `${s.medianReplyGapMinutes}분`],
        ["간격 P90", ins.replyGapP90Minutes === null ? "—" : `${ins.replyGapP90Minutes}분`],
        ["간격 CV", ins.replyGapCoeffVariation === null ? "—" : String(ins.replyGapCoeffVariation)],
        ["활성 시각 수", String(ins.activeHoursCount)],
        ["피크 시각", s.peakHour === null ? "—" : `${s.peakHour}시`],
        ["최장 연속일", String(s.longestActiveStreakDays)],
        ["최장 공백", ins.maxSilenceBetweenActiveDays === null ? "—" : `${ins.maxSilenceBetweenActiveDays}일`],
        ["피크일 점유", `${ins.peakDaySharePercent}%`],
        ["도메인 종류", String(ins.uniqueDomainCount)],
        ["도메인 H", ins.linkDomainEntropyBits === null ? "—" : `${ins.linkDomainEntropyBits} bit`],
        ["키워드 1위%", ins.keywordTop1SharePercent === null ? "—" : `${ins.keywordTop1SharePercent}%`],
        ["상위3 점유", `${ins.top3ParticipantSharePercent}%`],
        ["Gini", ins.participantGini === null ? "—" : String(ins.participantGini)],
        ["화자전환·100", String(ins.speakerSwitchRatePer100)],
        ["질문느낌·100", String(ins.questionLikeMessagesPer100)],
        ["이모지", formatNumber(s.emojiMessages)],
        ["평균 길이", String(s.averageMessageLength)],
        ["URL 포함 건", formatNumber(s.messagesWithLinks)],
        ["첨부 포함 건", formatNumber(s.messagesWithAttachments)],
    ];
    const inner = cells
        .map(([k, v]) => `<div class="fact-cell"><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`)
        .join("");
    const strip = `<div class="fact-hero-strip" aria-label="핵심 숫자 세 가지">
    <div class="fact-hero-cell"><b>총 메시지</b><span>${escapeHtml(formatNumber(s.totalMessages))}</span></div>
    <div class="fact-hero-cell"><b>참여자</b><span>${escapeHtml(formatNumber(s.participants))}</span></div>
    <div class="fact-hero-cell"><b>리듬 점수</b><span>${escapeHtml(String(ins.rhythmScore))}<small style="font-size:14px;font-weight:800;color:var(--muted)">/100</small></span></div>
  </div>`;
    return `<section id="s-facts" class="card fact-card anim-enter" aria-label="핵심 지표 요약" style="--enter-delay:0.03s">
    <h2>① 숫자 요약 (팩트 매트릭스)</h2>
    ${strip}
    <p class="fact-hint">외부 AI나 서버 없이, <strong>보낸 CSV 안의 숫자만</strong>으로 만든 표예요. 아래 칸이 많아 보여도, 위 세 칸만 봐도 대화 규모와 “살아 있는 정도” 감이 잡힙니다.</p>
    <div class="fact-grid">${inner}</div>
  </section>`;
}
function renderInsightDeck(data) {
    const ins = data.insights;
    const giniStr = ins.participantGini === null ? "—" : String(ins.participantGini);
    const p90 = ins.replyGapP90Minutes === null ? "—" : `${ins.replyGapP90Minutes}분`;
    const silence = ins.maxSilenceBetweenActiveDays === null ? "—" : `${ins.maxSilenceBetweenActiveDays}일`;
    const entropy = ins.linkDomainEntropyBits === null ? "—" : `${ins.linkDomainEntropyBits} bit`;
    const density = ins.densityMessagesPerCalendarDay === null ? "—" : String(ins.densityMessagesPerCalendarDay);
    const daypartBar = ins.daypartPercents
        .map((d) => {
        const w = Math.max(0, d.percent);
        const c = daypartColor(d.key);
        return `<span class="dp-seg" style="width:${w}%;background:${c}" title="${escapeHtml(d.label)} ${w}%"></span>`;
    })
        .join("");
    const scatter = renderParticipantScatter(data.participants);
    return `<section id="s-ai" class="card insight-hero anim-enter" style="margin-bottom:14px;--enter-delay:0.05s">
    <div class="insight-head">
      <div>
        <h2>③ 분위기·리듬 (고급 인사이트)</h2>
        <p class="insight-lede">참여가 고르지 않은지, 응답이 한번에 몰리는지, 링크가 여러 사이트로 퍼지는지 같은 <strong>패턴 지표</strong>예요. 낯선 말은 맨 아래 <a href="#s-help" data-kca-jump="s-help" style="color:var(--accent);font-weight:750">⑤ 용어 설명</a>을 펼쳐 보세요.</p>
      </div>
      <div class="rh-wrap anim-ring" aria-label="리듬 점수">
        <div class="rh-ring" style="--p:${ins.rhythmScore}"><span></span></div>
        <div class="rh-cap"><strong>리듬</strong><span>${ins.rhythmScore}<small>/100</small></span></div>
      </div>
    </div>
    <div class="insight-grid">
      ${insMetric("주말 비중", `${ins.weekendSharePercent}%`, "토·일 메시지 비율")}
      ${insMetric("참여 Gini", giniStr, "0에 가까우면 고르게 참여")}
      ${insMetric("간격 P90", p90, "느린 쪽 10% 구간")}
      ${insMetric("최장 공백", silence, "활동일 사이 최대 휴지")}
      ${insMetric("상위3 점유", `${ins.top3ParticipantSharePercent}%`, "메시지 많이 보낸 3명 합")}
      ${insMetric("도메인 H", entropy, "링크 사이트 다양성(bit)")}
      ${insMetric("캘린더 밀도", density, "달력 하루당 평균 메시지")}
      ${insMetric("질문 느낌", `${ins.questionLikeMessagesPer100}/100`, "물음표 포함 비슷한 톤")}
      ${insMetric("화자 전환", `${ins.speakerSwitchRatePer100}/100`, "100메시지당 말바꿈")}
    </div>
    <div class="insight-split">
      <div>
        <h3 class="insight-sub">하루 시간대 비중</h3>
        <p class="chart-hint">새벽·아침·낮·저녁 네 덩어리로 나눈 <strong>메시지 비율</strong>이에요.</p>
        <div class="daypart-bar" role="img" aria-label="시간대 비중">${daypartBar}</div>
        <ul class="daypart-legend">${ins.daypartPercents
        .map((d) => `<li><i style="background:${daypartColor(d.key)}"></i>${escapeHtml(d.label)} <strong>${d.percent}%</strong></li>`)
        .join("")}</ul>
      </div>
      <div>
        <h3 class="insight-sub">참여자 말풍선 맵</h3>
        <p class="chart-hint">가로는 <strong>비율(%)</strong>, 세로는 <strong>평균 글자 수</strong> (상위 12명).</p>
        ${scatter}
      </div>
    </div>
  </section>`;
}
function insMetric(label, value, sub) {
    return `<div class="ins-metric"><span class="ins-m-label">${escapeHtml(label)}</span><span class="ins-m-val">${escapeHtml(value)}</span><span class="ins-m-sub">${escapeHtml(sub)}</span></div>`;
}
function daypartColor(key) {
    switch (key) {
        case "dawn":
            return "linear-gradient(180deg,#818cf8,#4f46e5)";
        case "morning":
            return "linear-gradient(180deg,#22d3ee,#0891b2)";
        case "afternoon":
            return "linear-gradient(180deg,#4ade80,#059669)";
        case "evening":
            return "linear-gradient(180deg,#fb923c,#ea580c)";
        default:
            return "#64748b";
    }
}
function renderParticipantScatter(parts) {
    const top = parts.slice(0, 12);
    if (top.length === 0) {
        return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
    }
    const maxShare = Math.max(...top.map((p) => p.sharePercent), 0.1);
    const maxLen = Math.max(...top.map((p) => p.averageLength), 1);
    const minLen = Math.min(...top.map((p) => p.averageLength));
    const lenSpan = Math.max(maxLen - minLen, 0.1);
    const dots = top
        .map((p, i) => {
        const x = 8 + (p.sharePercent / maxShare) * 82;
        const yRaw = (p.averageLength - minLen) / lenSpan;
        const y = 12 + (1 - yRaw) * 76;
        const hue = (i * 53) % 360;
        return `<div class="sc-dot" style="left:${x}%;top:${y}%;background:hsl(${hue} 72% 52%)" title="${escapeHtml(p.alias)} · ${p.sharePercent}% · 평균 ${p.averageLength}자"></div>`;
    })
        .join("");
    return `<div class="sc-plot">${dots}<span class="sc-axis sc-x">점유 →</span><span class="sc-axis sc-y">길이 ↑</span></div>`;
}
function privacyLabel(mode) {
    if (mode === "public-masked")
        return "부분 마스킹(기본)";
    if (mode === "public-anonymous")
        return "완전 별칭(User 001)";
    return mode;
}
function panel(title, hint, content) {
    return `<div class="card"><h2>${escapeHtml(title)}</h2><p class="chart-hint" style="margin-top:-4px">${escapeHtml(hint)}</p>${content}</div>`;
}
function renderSelfServeCallout() {
    const gh = "https://github.com/claudianus/kakaotalk-chat-analyzer";
    const site = "https://claudianus.github.io/kakaotalk-chat-analyzer/";
    const npmShort = "https://www.npmjs.com/package/kcachat";
    const npmFull = "https://www.npmjs.com/package/kakaotalk-chat-analyzer";
    return `<section class="card self-serve" aria-label="리포트 직접 만들기">
    <h2>비슷한 리포트, 다른 대화에도 만들어보기</h2>
    <p>이 페이지는 <strong>KakaoTalk Chat Analyzer</strong>(CLI 이름 <strong>kca</strong>)로 만든 <strong>집계 전용</strong> 리포트예요. 카카오톡에서 CSV로 보낸 뒤 같은 방식으로 돌려볼 수 있습니다.</p>
    <ol>
      <li>카카오톡에서 채팅방 → <strong>더보기(≡)</strong> → <strong>대화보내기</strong> → <strong>CSV 보내기</strong>로 파일 저장</li>
      <li><strong>Node.js 22+</strong>가 있는 Mac/Windows/Linux에서 터미널을 열고, 보낸 파일 경로를 넣어 실행해 보세요.</li>
    </ol>
    <div class="cmd">npx kcachat@latest "./KakaoTalk_Chat_보낸파일.csv"</div>
    <p>기본은 리포트를 만든 뒤 <strong>BrewPage에 자동 업로드</strong>해 공유 링크를 출력합니다. PC에만 저장하려면 <code>--local</code> 을 붙이세요(업로드 생략, <code>index.html</code> 만 생성).</p>
    <p>짧은 이름이 부담스럽다면: <code>npx kakaotalk-chat-analyzer@latest "./파일.csv"</code> · 로컬만: <code>… --local</code></p>
    <p class="links">
      <a href="${gh}">GitHub 소스</a>
      · <a href="${npmShort}">npm · kcachat</a>
      · <a href="${npmFull}">npm · kakaotalk-chat-analyzer</a>
      · <a href="${site}">소개 페이지</a>
    </p>
  </section>`;
}
function renderDaily(days) {
    if (days.length === 0)
        return `<p style="margin:0;color:var(--muted);font-size:13px">날짜가 있는 메시지가 없습니다.</p>`;
    const max = Math.max(...days.map((day) => day.count), 1);
    const cols = `repeat(${days.length}, minmax(42px, 1fr))`;
    const cells = days
        .map((day) => {
        const ratio = day.count / max;
        const alpha = Math.min(0.92, Math.max(0.1, 0.1 + ratio * 0.82));
        const bg = `rgba(15, 107, 92, ${alpha.toFixed(2)})`;
        const fg = ratio > 0.42 ? "#f4f8f7" : "#0c2a24";
        const short = formatDayMd(day.date);
        return `<div class="day" title="${escapeHtml(day.date)} · ${day.count}건" style="background-color:${bg};color:${fg}"><span class="day-k">${escapeHtml(short)}</span><span class="day-n">${day.count}</span></div>`;
    })
        .join("");
    return `<div class="calendar-wrap">
    <p class="chart-hint">각 칸: <strong>월/일</strong>(위) · 해당일 <strong>메시지 수</strong>(아래). 온전한 날짜는 칸에 마우스를 올리면 툴팁으로 보입니다.</p>
    <div class="calendar-scroll">
      <div class="calendar" style="grid-template-columns:${cols}">${cells}</div>
    </div>
  </div>`;
}
function renderMonthly(months) {
    if (months.length === 0)
        return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
    return renderCountBars(months.map((m) => ({ label: m.date, count: m.count })));
}
function renderHours(hours) {
    const max = Math.max(...hours, 1);
    const bars = hours
        .map((count, hour) => {
        const height = Math.max(2, Math.round((count / max) * 100));
        return `<div class="hour" title="${hour}시 · ${formatNumber(count)}건" style="height:${height}%"></div>`;
    })
        .join("");
    const labels = Array.from({ length: 24 }, (_, hour) => `<span title="${hour}시">${hour}</span>`).join("");
    return `<div class="hours-wrap">
    <p class="chart-hint">가로 한 칸이 <strong>1시간</strong>입니다. 아래 숫자는 <strong>시각(0~23시)</strong>이며, 막대 높이는 해당 시간대 메시지 수 비율입니다.</p>
    <div class="hours-scroll">
      <div class="hours-chart-inner">
        <div class="hours-bars">${bars}</div>
        <div class="hours-labels">${labels}</div>
      </div>
    </div>
  </div>`;
}
/** YYYY-MM-DD → M/D (앞자리 0 제거) */
function formatDayMd(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
    if (!m)
        return ymd;
    return `${Number(m[2])}/${Number(m[3])}`;
}
function renderParticipants(participants) {
    if (participants.length === 0) {
        return `<p style="margin:0;color:var(--muted);font-size:13px">참여자 데이터가 없습니다.</p>`;
    }
    return `<table class="table"><thead><tr><th>표시명</th><th class="num">메시지</th><th class="num">비율</th><th class="num">평균 길이</th><th class="num">URL</th><th class="num">첨부</th><th class="num">심야</th><th class="num">연속 최대</th></tr></thead><tbody>${participants
        .map((p) => `<tr><td>${escapeHtml(p.alias)}</td><td class="num">${formatNumber(p.messages)}</td><td class="num">${p.sharePercent}%</td><td class="num">${p.averageLength}</td><td class="num">${formatNumber(p.linkMessages)}</td><td class="num">${formatNumber(p.attachmentMessages)}</td><td class="num">${formatNumber(p.nightMessages)}</td><td class="num">${formatNumber(p.maxConsecutive)}</td></tr>`)
        .join("")}</tbody></table>`;
}
function renderCountBars(items) {
    if (items.length === 0)
        return `<p style="margin:0;color:var(--muted);font-size:13px">데이터가 없습니다.</p>`;
    const max = Math.max(...items.map((item) => item.count), 1);
    return `<div class="bars">${items
        .map((item) => {
        const width = Math.max(2, Math.round((item.count / max) * 100));
        return `<div class="bar-row"><span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span><span class="bar-value">${formatNumber(item.count)}</span></div>`;
    })
        .join("")}</div>`;
}
function renderHighlightLine(line) {
    const parts = line.split("**");
    return parts.map((part, i) => (i % 2 === 1 ? `<strong>${escapeHtml(part)}</strong>` : escapeHtml(part))).join("");
}
function formatNumber(value) {
    return new Intl.NumberFormat("ko-KR").format(value);
}
function formatTimestamp(value) {
    try {
        return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    }
    catch {
        return value;
    }
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function escapeJsonForHtml(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
//# sourceMappingURL=report.js.map