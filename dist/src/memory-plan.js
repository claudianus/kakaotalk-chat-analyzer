import { effectiveLlmHeadroomGb, pickLargestQwen35ForRam, } from "./llm-resolve.js";
const timeline = [];
export function resetMemoryTimeline() {
    timeline.length = 0;
}
export function pushMemoryTimeline(phase, profile, extra) {
    timeline.push({
        phase,
        availableGb: Math.round(profile.availableMemGb * 10) / 10,
        freeGb: Math.round(profile.freeMemGb * 10) / 10,
        totalGb: Math.round(profile.totalMemGb * 10) / 10,
        ...extra,
    });
}
export function getMemoryTimeline() {
    return timeline;
}
export { effectiveLlmHeadroomGb };
/** post-ML headroom으로 선택 가능한 최대 Qwen3.5 */
export function pickLargestQwen35AfterMl(profile) {
    return pickLargestQwen35ForRam(effectiveLlmHeadroomGb(profile));
}
//# sourceMappingURL=memory-plan.js.map