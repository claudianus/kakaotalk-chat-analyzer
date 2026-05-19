# LLM 런타임 복원력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 또는 executing-plans로 태스크별 구현. 체크박스로 진행 추적.

**Goal:** LLM(Metal/GGUF) 네이티브 크래시·RAM 과대 선택이 **전체 분석을 죽이지 않도록** child 격리 + post-ML 메모리 플래너 + GPU 정책을 도입한다.

**Architecture:** `finalize` 이후 `MemoryPlanner`가 모델·GPU를 정하고, `llm-subprocess`가 짧은 child에서 `runLlamaPrompt`를 실행한다. 비정상 exit는 fallback ladder로 CPU·소형 모델·규칙 서사까지 내려가며 **항상 ReportData + HTML**을 만든다.

**Tech Stack:** Node 22+, node-llama-cpp (child only), 기존 llm-resolve / analysis-budget / provenance

**Design spec:** [`specs/2026-05-19-llm-runtime-resilience-design.md`](../specs/2026-05-19-llm-runtime-resilience-design.md)

---

## 파일 맵

| 파일 | 액션 |
|------|------|
| `src/llm-subprocess.ts` | **Create** — spawn, IPC, signal |
| `src/llm-infer-cli.ts` | **Create** — child entry |
| `src/memory-plan.ts` | **Create** — post-ML planner |
| `src/llm-gpu-policy.ts` | **Create** — darwin GPU rules |
| `src/llm-runtime.ts` | **Modify** — delegate to subprocess |
| `src/llm-resolve.ts` | **Modify** — use MemoryPlan |
| `src/llm-summarize.ts` | **Modify** — ladder integration |
| `src/analysis.ts` | **Modify** — single plan source, logging |
| `src/report-provenance.ts` | **Modify** — memoryTimeline |
| `src/analysis-effective-config.ts` | **Modify** — fallback 표시 |
| `test/llm-subprocess.test.ts` | **Create** |
| `test/memory-plan.test.ts` | **Create** |
| `package.json` | **Modify** — bin `kca-llm-infer` optional |
| `README.md`, `kcachat/README.md` | **Modify** |
| `package.json` version | **0.20.0** (P2) |

---

## Phase P0 — Child 격리 (Reliability Lead)

### Task 1: subprocess 프로토콜

**Files:**
- Create: `src/llm-subprocess.ts`
- Create: `src/llm-infer-cli.ts`

- [ ] **Step 1:** `LlmInferRequest` / `LlmInferResponse` 타입 정의 (JSON one-shot stdin/stdout)
- [ ] **Step 2:** `runLlmInChildProcess(req): Promise<LlmInferResponse>` — `spawn(process.execPath, [inferCli], { stdio: ['pipe','pipe','pipe'] })`
- [ ] **Step 3:** `decodeChildFailure(code, signal)` → `{ kind: 'segfault'|'oom'|'timeout'|'error', message }`
- [ ] **Step 4:** child CLI: `import('./llm-runtime-internal.js')` — **getLlama + prompt only** (부모와 분리 모듈)

- [ ] **Step 5:** Test — mock script `exit(139)` → parent gets `segfault`, no throw

```bash
npm test -- test/llm-subprocess.test.ts
```

### Task 2: runLlamaPrompt 위임

**Files:**
- Modify: `src/llm-runtime.ts`
- Modify: `package.json` (files/bin if needed)

- [ ] **Step 1:** `runLlamaPrompt` → `runLlmInChildProcess` (기존 in-process는 `KCA_LLM_IN_PROCESS=1` dev only)
- [ ] **Step 2:** load/infer timeout을 child에 전달
- [ ] **Step 3:** Manual — quality CSV → exit 0 (Metal 환경)

### Task 3: Fallback ladder

**Files:**
- Modify: `src/llm-summarize.ts`

- [ ] **Step 1:** `runLlmCompletion` 실패 시 `gpu=none` 동일 size 1회
- [ ] **Step 2:** 재실패 시 `downgradeSize(size)` 1회
- [ ] **Step 3:** stderr `[kca] LLM Metal 크래시 → CPU 재시도 (Qwen3.5-2B)` 패턴
- [ ] **Step 4:** Test — mock child sequence

### Task 4: analyze-worker

**Files:**
- Modify: `src/analyze-worker.ts` (필요 시)

- [ ] **Step 1:** worker 내 LLM도 subprocess 경로만 사용 확인
- [ ] **Step 2:** worker 비정상 종료 시 main이 parse error 메시지 개선 (기존 worker fatal vs LLM 분리)

---

## Phase P1 — Memory planner (ML Platform)

### Task 5: memory-plan 모듈

**Files:**
- Create: `src/memory-plan.ts`
- Create: `test/memory-plan.test.ts`

- [ ] **Step 1:** `ggufMinHeadroomGb(size)` — catalog `minHeadroomGb` + 1GB slack
- [ ] **Step 2:** `planLlmAfterMl({ profile, preset, phases })` → `{ size?, gpu, reason, effectiveHeadroomGb }`
- [ ] **Step 3:** free < `minFreeGbForLlmRetry` → downgrade loop
- [ ] **Step 4:** Tests — free 3GB → 0.8B or off; free 14GB → 최대 4B not 9B if onnx reserved

### Task 6: llm-resolve 통합

**Files:**
- Modify: `src/llm-resolve.ts`
- Modify: `src/analysis.ts`

- [ ] **Step 1:** `resolveLlmRunPlan`에 optional `MemoryPlanContext` (post-ml profile)
- [ ] **Step 2:** `buildReportFromExportSync` — ML dispose **후**만 최종 plan
- [ ] **Step 3:** 분석 시작 plan은 budget estimate용으로만 (`llmPlanHint` deprecated path 정리)

### Task 7: provenance

**Files:**
- Modify: `src/report-provenance.ts`, `src/types.ts`

- [ ] **Step 1:** `llmMemoryTimeline: { phase, availableGb, freeGb, chosenSize?, gpu? }[]`
- [ ] **Step 2:** test snapshot field exists

---

## Phase P2 — GPU policy & docs (Native + PM)

### Task 8: llm-gpu-policy

**Files:**
- Create: `src/llm-gpu-policy.ts`

- [ ] **Step 1:** `resolveLlmGpuMode(profile, size, userEnv)` 구현 (design §2.3 테이블)
- [ ] **Step 2:** `applyGgmlMetalCompatibilityEnv` 호출 통합
- [ ] **Step 3:** test darwin + low free → none

### Task 9: 문서·버전

**Files:**
- Modify: `README.md`, `kcachat/README.md`, `package.json`

- [ ] **Step 1:** 트러블슈팅 “LLM 단계에서 조용히 종료” → 0.20에서 해결 설명
- [ ] **Step 2:** env `KCA_LLM_GPU` 고급 옵션으로 이동
- [ ] **Step 3:** version 0.20.0, `npm test`, `npm run report:qa` (AGENTS §5)

### Task 10: CI (optional)

**Files:**
- Create: `.github/workflows/llm-smoke-macos.yml`

- [ ] **Step 1:** workflow_dispatch, `KCA_LLM_MODEL=0.8B`, fixture CSV
- [ ] **Step 2:** non-blocking → green 후 required 승격

---

## 검증 체크리스트 (완료 정의)

- [ ] `npx kcachat@latest` 동일 CSV quality → **exit 0**, `.tmp/kca-report/index.html` 존재
- [ ] provenance에 LLM used 또는 `llmSkippedReason`
- [ ] `npm test` 전체 통과
- [ ] cubic PR pass + 시각 QA 이상 없음

---

## 에이전트 배정 (병렬)

| 에이전트 | Task |
|----------|------|
| Reliability | 1, 2, 3, 4 |
| ML Platform | 5, 6, 7 |
| Native + PM | 8, 9 |
| QA | 1 test, 5 test, 10 |

**순서:** Task 1→2→3 (P0) 병렬 시작 후 Task 5→6 (P1). Task 8–10은 P0 수동 재현 통과 후.
