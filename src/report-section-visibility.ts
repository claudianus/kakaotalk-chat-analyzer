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

export function hasSentimentRollercoaster(data: ReportData): boolean {
  return data.dailySentiment.length >= 3;
}

export function hasRhythmSilenceMap(data: ReportData): boolean {
  return data.insights.sessionCount >= 2;
}

export function hasParticipantDynamics(data: ReportData): boolean {
  return data.participants.length >= 2;
}

export function hasDaypartFingerprint(data: ReportData): boolean {
  return data.hourly.some((c) => c > 0);
}

export function hasTopicFlow(data: ReportData): boolean {
  return (
    Boolean(data.smartTopicTrend?.items.length && data.smartTopicTrend.items.length >= 2) ||
    data.topics.length >= 2
  );
}

export function hasSentimentWeatherStrip(data: ReportData): boolean {
  return (data.recentSnapshot?.week?.length ?? 0) >= 3 || data.dailySentiment.length >= 3;
}

export function hasActivityRestRhythm(data: ReportData): boolean {
  return data.daily.length >= 3;
}

export function hasRoomCultureStrip(data: ReportData): boolean {
  return (
    data.repeatedPhrases.length > 0 || (data.llmInsights?.insideJokes?.length ?? 0) > 0
  );
}
