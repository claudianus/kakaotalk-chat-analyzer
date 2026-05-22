export interface HonorificAnalysis {
    honorificCount: number;
    casualCount: number;
    honorificRatio: number;
    casualRatio: number;
    dominantStyle: "honorific" | "casual" | "mixed";
}
export declare function analyzeHonorificStyle(text: string): "honorific" | "casual" | "neutral";
export declare function analyzeParticipantHonorific(messages: string[]): HonorificAnalysis;
