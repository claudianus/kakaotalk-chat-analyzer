import type { ReportData } from "./types.js";

export function hasNarrativeSection(data: ReportData): boolean {
  return (
    data.narrative.paragraphs.length > 0 ||
    Boolean(data.llmInsights?.moments?.length) ||
    Boolean(data.llmInsights?.insightBullets?.length) ||
    Boolean(data.llmInsights?.topicProposals?.length)
  );
}

export function hasTimelineSection(data: ReportData): boolean {
  return data.timeline.length > 0;
}

export function hasDyadSection(data: ReportData): boolean {
  return data.interaction != null && data.interaction.totalReplies >= 3;
}

export function hasExplorerSection(data: ReportData): boolean {
  return data.explorer.daily.length >= 3;
}

export function hasBenchmarkSection(data: ReportData): boolean {
  if (process.env.KCA_BENCHMARK === "1") {
    return data.benchmarks.length > 0;
  }
  return false;
}

export function hasCalendarHeatmap(data: ReportData): boolean {
  return data.story.calendarWeeks.length > 0;
}

export function showMonthlyChart(data: ReportData): boolean {
  const months = new Set(data.monthly.map((m) => m.date.slice(0, 7)));
  return months.size >= 6;
}
