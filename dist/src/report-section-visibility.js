export function hasNarrativeSection(data) {
    return data.narrative.paragraphs.length > 0;
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
    return data.benchmarks.length > 0;
}
//# sourceMappingURL=report-section-visibility.js.map