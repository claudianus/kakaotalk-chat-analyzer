export declare function normalizeVector(v: number[]): number[];
/** L2 정규화 벡터에 대한 k-means (k-means++ 초기화) */
export declare function kMeansAssignments(vectors: number[][], k: number, maxIter?: number): number[];
/** 클러스터 내 평균 코사인 유사도 (0~1) */
export declare function clusterMeanCoherence(vectors: number[][], assignments: number[], clusterId: number): number;
export interface ClusterLabel {
    terms: string[];
    size: number;
    coherence: number;
}
/** 클러스터별 토큰 빈도 상위 용어 */
export declare function labelClustersFromTokens(assignments: number[], tokenBags: string[][], k: number, stopwords: ReadonlySet<string>, topPerCluster?: number, vectors?: number[][], minCoherence?: number): ClusterLabel[];
