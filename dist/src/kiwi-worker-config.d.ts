/** Kiwi spool 병렬 토큰화 worker 수 (1 = 비활성, 메인 스레드만) */
export declare function resolveKiwiWorkerCount(): number;
export declare function kiwiWorkerPoolEnabled(workerCount: number, messageCount: number): boolean;
