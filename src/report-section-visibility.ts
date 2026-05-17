import type { ReportData } from "./types.js";

export function hasNarrativeSection(data: ReportData): boolean {
  return data.narrative.paragraphs.length > 0 || Boolean(data.llmInsights);
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
  return data.benchmarks.length > 0;
}
