export declare function normalizeVector(v: number[]): number[];
/** L2 정규화 벡터에 대한 간단 k-means */
export declare function kMeansAssignments(vectors: number[][], k: number, maxIter?: number): number[];
export interface ClusterLabel {
    terms: string[];
    size: number;
}
/** 클러스터별 토큰 빈도 상위 용어 */
export declare function labelClustersFromTokens(assignments: number[], tokenBags: string[][], k: number, stopwords: ReadonlySet<string>, topPerCluster?: number): ClusterLabel[];
