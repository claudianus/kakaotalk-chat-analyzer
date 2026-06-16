import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export const PROHIBITED_KEYWORDS = [
  "그냥",
  "근데",
  "솔직히",
  "아무튼",
  "그니까",
  "그러니까",
  "맞아요",
  "네네",
];

const LLM_SLOP_RE =
  /(?:AI 분석 결과|압도적|압도적인|흥미로운|흥미롭게도|다채로운|놀라운|놀랍게도|풍부한 대화|의미 있는 대화|다양한 이야기를 나누는|시사합니다|특별한 공간입니다|활발한 소통의 장)/;

export async function collectHtmlFiles(paths) {
  const out = [];
  for (const raw of paths) {
    const path = resolve(raw);
    const info = await stat(path);
    if (info.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true });
      for (const entry of entries) {
        const child = join(path, entry.name);
        if (entry.isDirectory()) out.push(...await collectHtmlFiles([child]));
        else if (entry.isFile() && entry.name.endsWith(".html")) out.push(child);
      }
    } else if (info.isFile() && path.endsWith(".html")) {
      out.push(path);
    }
  }
  return out.sort();
}

function extractJsonScript(html, id) {
  const re = new RegExp(`<script type="application/json" id="${id}">([\\s\\S]*?)<\\/script>`);
  const match = re.exec(html);
  if (!match?.[1]) return null;
  return JSON.parse(match[1]);
}

function addTopicNames(values, topics) {
  for (const topic of topics ?? []) {
    if (topic.title) values.push(topic.title);
    for (const term of topic.terms ?? []) values.push(term);
    if (topic.name) values.push(topic.name);
  }
}

function chartKeywordValues(chart) {
  const values = [];
  for (const item of chart.keywords ?? []) values.push(item.label);
  for (const item of chart.keywordsDistinctive ?? []) values.push(item.label);
  addTopicNames(values, chart.topicsThemes);
  addTopicNames(values, chart.topicsPeriods);
  for (const period of chart.topicTrend ?? []) addTopicNames(values, period.topics);
  for (const period of chart.smartTopicTrend?.items ?? []) addTopicNames(values, period.topics);
  return values;
}

export async function auditReportHtml(path) {
  const html = await readFile(path, "utf8");
  const failures = [];
  const warnings = [];
  let chart = null;
  let provenance = null;

  try {
    chart = extractJsonScript(html, "kca-chart-data");
  } catch (error) {
    failures.push(`chart JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    provenance = extractJsonScript(html, "kca-provenance");
  } catch (error) {
    failures.push(`provenance JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!chart) failures.push("#kca-chart-data missing");
  if (!provenance) failures.push("#kca-provenance missing");

  if (chart) {
    const exposed = new Set(chartKeywordValues(chart));
    for (const word of PROHIBITED_KEYWORDS) {
      if (exposed.has(word)) failures.push(`prohibited keyword exposed in chart payload: ${word}`);
    }
    if (!Array.isArray(chart.keywords) || chart.keywords.length === 0) {
      warnings.push("keyword chart payload is empty");
    }
    const trend = chart.smartTopicTrend;
    if (trend) {
      if (!["daily", "weekly", "monthly"].includes(trend.granularity)) {
        failures.push(`invalid smartTopicTrend granularity: ${trend.granularity}`);
      }
      if (!trend.label || !trend.hint) failures.push("smartTopicTrend label/hint missing");
      if (!Array.isArray(trend.items) || trend.items.length === 0) {
        warnings.push("smartTopicTrend has no items");
      }
    }
  }

  if (provenance) {
    if (!provenance.generator?.version) failures.push("provenance generator.version missing");
    if (!provenance.analysis?.privacy) failures.push("provenance analysis.privacy missing");
    if (provenance.analysis?.llmUsed && !provenance.analysis?.llmQuality) {
      failures.push("LLM used but llmQuality missing");
    }
  }

  if (!html.includes('id="chart-kw-cloud"')) failures.push("keyword chart canvas missing");
  if (!html.includes("empty-state")) warnings.push("empty-state markup missing");
  if (LLM_SLOP_RE.test(html)) failures.push("AI slop phrase exposed in HTML");

  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes < 20_000) failures.push(`HTML too small: ${bytes} bytes`);
  if (bytes > 8 * 1024 * 1024) failures.push(`HTML too large: ${bytes} bytes`);

  return {
    path,
    ok: failures.length === 0,
    failures,
    warnings,
    bytes,
    llmQuality: provenance?.analysis?.llmQuality,
    smartTopicTrend: chart?.smartTopicTrend
      ? {
          granularity: chart.smartTopicTrend.granularity,
          label: chart.smartTopicTrend.label,
          items: chart.smartTopicTrend.items?.length ?? 0,
        }
      : null,
  };
}
