/** 말풍선 맵 겹침 완화: 데이터 좌표(%) → 충돌 없는 위치 */
const MIN_DIST = 13.5;
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
/** 큰 말풍선부터 배치하고 겹치면 나선형으로 밀어냄 */
export function resolveBubbleOverlaps(items) {
    const sorted = items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => b.item.scale - a.item.scale || a.index - b.index);
    const placed = [];
    for (const { item } of sorted) {
        let x = clamp(item.x, 10, 90);
        let y = clamp(item.y, 12, 88);
        let nudged = false;
        if (placed.length > 0) {
            const minSep = MIN_DIST + item.scale * 2.2;
            for (let attempt = 0; attempt < 48; attempt++) {
                const hit = placed.some((p) => dist({ x, y, scale: item.scale, nudged }, p) < minSep + p.scale * 2);
                if (!hit)
                    break;
                const angle = attempt * 0.85;
                const radius = minSep * (0.35 + attempt * 0.08);
                x = clamp(item.x + Math.cos(angle) * radius, 8, 92);
                y = clamp(item.y + Math.sin(angle) * radius, 10, 90);
                nudged = true;
            }
        }
        placed.push({ x, y, scale: item.scale, nudged });
    }
    const out = new Array(items.length);
    sorted.forEach(({ index }, i) => {
        out[index] = placed[i];
    });
    return out;
}
function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
}
//# sourceMappingURL=bubble-layout.js.map