/** 말풍선 맵 겹침 완화: 데이터 좌표(%) → 충돌 없는 위치 */
export interface BubbleLayoutInput {
    x: number;
    y: number;
    scale: number;
}
export interface BubbleLayoutResult extends BubbleLayoutInput {
    nudged: boolean;
}
/** 큰 말풍선부터 배치하고 겹치면 나선형으로 밀어냄 */
export declare function resolveBubbleOverlaps(items: BubbleLayoutInput[]): BubbleLayoutResult[];
