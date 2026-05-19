export function hasNarrativeSection(data) {
    return (data.narrative.paragraphs.length > 0 ||
        Boolean(data.llmInsights?.moments?.length) ||
        Boolean(data.llmInsights?.insightBullets?.length) ||
        Boolean(data.llmInsights?.topicProposals?.length));
}
export function hasTimelineSection(data) {
    return data.timeline.length > 0;
}
export function hasDyadSection(data) {
    return data.interaction != null && data.interaction.totalReplies >= 3;
}
export function hasExplorerSection(data) {
    return data.explorer.daily.length >= 3;
}
export function hasBenchmarkSection(data) {
    if (process.env.KCA_BENCHMARK === "1") {
        return data.benchmarks.length > 0;
    }
    return false;
}
export function hasCalendarHeatmap(data) {
    return data.story.calendarWeeks.length > 0;
}
export function showMonthlyChart(data) {
    const months = new Set(data.monthly.map((m) => m.date.slice(0, 7)));
    return months.size >= 6;
}
//# sourceMappingURL=report-section-visibility.js.map