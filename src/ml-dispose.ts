import { disposeSemanticPipeline } from "./semantic-keywords.js";
import { disposeSentimentPipeline } from "./sentiment-analyze.js";
import { disposeToxicityPipeline } from "./toxicity-analyze.js";

/** utterance ML ONNX 파이프라인 해제 — LLM GGUF 로드 전 RAM 확보 */
export async function disposeUtteranceMlPipelines(): Promise<void> {
  await Promise.all([
    disposeSemanticPipeline(),
    disposeSentimentPipeline(),
    disposeToxicityPipeline(),
  ]);
}
