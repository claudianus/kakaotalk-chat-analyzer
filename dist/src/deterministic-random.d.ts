export declare const KCA_DETERMINISTIC_SEED = 1262698801;
export declare function hashString(input: string, seed?: number): number;
export declare function hashFraction(input: string, seed?: number): number;
export declare function deterministicIndex(length: number, key: string, seed?: number): number;
export declare function deterministicPick<T>(items: readonly T[], key: string, seed?: number): T;
