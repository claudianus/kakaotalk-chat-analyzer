export const KCA_DETERMINISTIC_SEED = 0x4b434131;
export function hashString(input, seed = KCA_DETERMINISTIC_SEED) {
    let h = 2166136261 ^ seed;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
export function hashFraction(input, seed = KCA_DETERMINISTIC_SEED) {
    return hashString(input, seed) / 0x1_0000_0000;
}
export function deterministicIndex(length, key, seed = KCA_DETERMINISTIC_SEED) {
    if (length <= 1)
        return 0;
    return hashString(key, seed) % length;
}
export function deterministicPick(items, key, seed = KCA_DETERMINISTIC_SEED) {
    if (items.length === 0)
        throw new Error("deterministicPick requires at least one item");
    return items[deterministicIndex(items.length, key, seed)];
}
//# sourceMappingURL=deterministic-random.js.map