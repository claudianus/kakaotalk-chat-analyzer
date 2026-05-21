import {
  probeMachineProfileSync,
  analysisBudgetMs,
} from "./dist/src/analysis-capability.js";
import {
  autoPresetFromMachine,
  getPresetEffectiveFlags,
} from "./dist/src/analysis-preset.js";
import {
  effectiveLlmHeadroomGb,
  memoryHeadroomForLlmLoad,
  resolveLlmRunPlan,
} from "./dist/src/llm-resolve.js";
import { AnalysisBudgetTracker, phaseReserveMs } from "./dist/src/analysis-budget.js";

// 사용자 시스템 프로필 (이전 로그에서 추출)
const profile = {
  totalMemGb: 48,
  freeMemGb: 2.8,
  availableMemGb: 23,
  cpuCores: 10,
  platform: "darwin",
  arch: "arm64",
  gpu: "metal",
};

const messageCount = 102_897;

console.log("=== 사용자 시스템 프로필 ===");
console.log(`총 RAM: ${profile.totalMemGb}GB`);
console.log(`Free RAM: ${profile.freeMemGb}GB`);
console.log(`Available RAM: ${profile.availableMemGb}GB`);
console.log(`메시지 수: ${messageCount.toLocaleString()}`);
console.log();

// 1. Preset 자동 선택
const preset = autoPresetFromMachine(profile, messageCount);
console.log(`=== 1. 프리셋 선택 ===`);
console.log(`결과: ${preset}`);
console.log(`기대: ultra (48GB+ & headroom 23GB)`);
console.log(`통과: ${preset === "ultra" ? "✅" : "❌"}`);
console.log();

// 2. LLM Headroom 계산
const loadHeadroom = memoryHeadroomForLlmLoad(profile);
const effectiveHeadroom = effectiveLlmHeadroomGb(profile);
console.log(`=== 2. LLM RAM Headroom ===`);
console.log(`Load headroom: ${loadHeadroom}GB`);
console.log(`Effective headroom: ${effectiveHeadroom}GB`);
console.log(`기대: effective >= 5GB (2B 모델 minimum)`);
console.log(`통과: ${effectiveHeadroom >= 5 ? "✅" : "❌"}`);
console.log();

// 3. LLM 실행 계획
const llmPlan = resolveLlmRunPlan({
  preset,
  profile,
  messageCount,
  postMl: true,
});
console.log(`=== 3. LLM 실행 계획 ===`);
console.log(`Enabled: ${llmPlan.enabled}`);
console.log(`Size: ${llmPlan.size || "N/A"}`);
console.log(`Reason: ${llmPlan.reason}`);
console.log(`기대: enabled=true, size=2B 또는 4B 또는 9B`);
console.log(`통과: ${llmPlan.enabled ? "✅" : "❌"}`);
console.log();

// 4. 분석 예산
const budget = analysisBudgetMs(preset, messageCount, profile);
console.log(`=== 4. 분석 예산 ===`);
console.log(`Budget: ${budget}ms (${(budget / 1000).toFixed(0)}s)`);
console.log(`기대: 600s (ultra + 48GB+)`);
console.log(`통과: ${budget === 600_000 ? "✅" : "❌"}`);
console.log();

// 5. Phase 예약 시간
const semanticReserve = phaseReserveMs("semantic", preset, profile);
const llmReserve = phaseReserveMs("llm", preset, profile, llmPlan.size);
console.log(`=== 5. Phase 예약 시간 ===`);
console.log(`Semantic reserve: ${semanticReserve}ms`);
console.log(`LLM reserve: ${llmReserve}ms`);
console.log(`기대: semantic <= 90s, LLM <= 120s`);
console.log(`통과: ${semanticReserve <= 90_000 && llmReserve <= 120_000 ? "✅" : "❌"}`);
console.log();

// 6. Budget tracker - LLM skip 여부
const tracker = new AnalysisBudgetTracker(preset, messageCount, profile, llmPlan.size);
const simulatedRemain = budget - 300_000; // 분석이 300초 걸렸다고 가정
const originalRemaining = tracker.remainingMs;
tracker.remainingMs = () => simulatedRemain;
const shouldSkipLlm = tracker.shouldSkip("llm");
tracker.remainingMs = originalRemaining;
console.log(`=== 6. LLM Skip 여부 (시뮬레이션) ===`);
console.log(`남은 예산(가정): ${simulatedRemain}ms (${(simulatedRemain / 1000).toFixed(0)}s)`);
console.log(`LLM 예약 필요: ${llmReserve}ms`);
console.log(`Skip 여부: ${shouldSkipLlm}`);
console.log(`기대: false (300s 후에도 300s 남아 있음)`);
console.log(`통과: ${!shouldSkipLlm ? "✅" : "❌"}`);
console.log();

// 7. 총평
const allPass =
  preset === "ultra" &&
  effectiveHeadroom >= 5 &&
  llmPlan.enabled &&
  budget === 600_000 &&
  !shouldSkipLlm;

console.log("=== 최종 결과 ===");
console.log(allPass ? "🎉 모든 검증 통과 — 풀퀄리티 가동 예상" : "⚠️ 일부 검증 실패");
