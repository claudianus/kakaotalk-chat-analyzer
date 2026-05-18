import { stat } from "node:fs/promises";
import { buildLlmPromptPayload, LLM_SYSTEM_PROMPT } from "./llm-input.js";
import { ggufPathForSize } from "./llm-cache.js";
import { llmTimeoutMs, resolveLlmRunPlan, type LlmRunPlan } from "./llm-policy.js";
import { ensureLlmGgufReady } from "./llm-ensure.js";
import { qwen35DisplayLabel, type Qwen35Size } from "./llm-qwen35.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import type { AnalysisPresetName } from "./analysis-preset.js";
import type { BuildReportOptions } from "./analyze-pool.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { mergeTopicProposals, type LlmTopicProposal } from "./topic-merge.js";
import type { LlmInsights, ReportData, ReportTopic } from "./types.js";
import type { RoomNarrative } from "./room-narrative.js";

export interface LlmEnrichmentResult {
  used: boolean;
  plan: LlmRunPlan;
  narrative?: RoomNarrative;
  topics?: ReportTopic[];
  llmInsights?: LlmInsights;
}

interface LlmJsonShape {
  topicTitles?: { i: number; title: string }[];
  topicProposals?: LlmTopicProposal[];
  paragraphs?: string[];
  insightBullets?: string[];
  shopSearchSummary?: string;
  dyadInsight?: string;
}

function parseLlmJson(text: string): LlmJsonShape | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as LlmJsonShape;
  } catch {
    return null;
  }
}

function resolveTimeoutMs(plan: LlmRunPlan, size: Qwen35Size): number {
  if (plan.timeoutMs && plan.timeoutMs > 0) return plan.timeoutMs;
  return llmTimeoutMs();
}

async function runOllama(prompt: string, plan: LlmRunPlan, size: Qwen35Size, timeoutMs: number): Promise<string> {
  const host = process.env.KCA_OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
  const model = process.env.KCA_OLLAMA_MODEL?.trim() || plan.ollamaModel;
  if (!model) throw new Error("Ollama model 미설정");
  const body = {
    model,
    prompt: `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`,
    stream: false,
    options: { num_predict: 768 },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = (await res.json()) as { response?: string };
    return json.response ?? "";
  } finally {
    clearTimeout(timer);
  }
}

async function runNodeLlama(prompt: string, size: Qwen35Size, timeoutMs: number): Promise<string> {
  const ready = await ensureLlmGgufReady(size);
  const modelPath = ggufPathForSize(size);
  if (!ready) {
    throw new Error(
      `Qwen3.5 GGUF 없음: ${modelPath} (kca llm pull 또는 네트워크 확인)`,
    );
  }
  await stat(modelPath);

  const mod = "node-llama-cpp";
  const { getLlama, LlamaChatSession } = await import(mod);
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath });
  const context = await model.createContext({ contextSize: 4096 });
  const session = new LlamaChatSession({
    contextSequence: context.getSequence(),
  });

  const fullPrompt = `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`;
  const run = session.prompt(fullPrompt, { maxTokens: 768 });
  const timed = Promise.race([
    run,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("LLM timeout")), timeoutMs);
    }),
  ]);
  const reply = await timed;
  await context.dispose?.();
  await model.dispose?.();
  return typeof reply === "string" ? reply : String(reply);
}

async function runMockLlm(): Promise<string> {
  return JSON.stringify({
    topicTitles: [{ i: 0, title: "모의 LLM 주제" }],
    topicProposals: [
      {
        title: "AI 코딩 도구",
        terms: ["클로드", "코덱스", "토큰"],
        keywordEvidence: ["클로드", "코덱스"],
      },
    ],
    paragraphs: [
      "**통계 기반** 서사 첫 문단입니다.",
      "두 번째 문단은 규칙 기반 서사를 보강합니다.",
    ],
    insightBullets: ["모의 인사이트: 상위 키워드가 개발·AI 도구에 집중됩니다."],
    shopSearchSummary: "샵검색 태그는 소수이며 환율·계산기 등 실용 주제가 보입니다.",
    dyadInsight: "상위 두 명이 대화 허브 역할을 합니다.",
  });
}

export async function runLlmCompletion(
  data: ReportData,
  plan: LlmRunPlan,
): Promise<string | null> {
  if (!plan.enabled || !plan.size) return null;
  const size = plan.size;
  const prompt = buildLlmPromptPayload(data);
  const timeoutMs = resolveTimeoutMs(plan, size);

  try {
    if (process.env.KCA_LLM_MOCK === "1") {
      return runMockLlm();
    }
    if (process.env.KCA_LLM_BACKEND?.trim().toLowerCase() === "ollama") {
      return await runOllama(prompt, plan, size, timeoutMs);
    }
    return await runNodeLlama(prompt, size, timeoutMs);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[kca] LLM 건너뜀 (${qwen35DisplayLabel(size)}): ${msg}\n`);
    return null;
  }
}

function mergeTopics(data: ReportData, parsed: LlmJsonShape): ReportTopic[] {
  const topics = data.topics.map((t) => ({ ...t }));
  for (const row of parsed.topicTitles ?? []) {
    const t = topics[row.i];
    if (t && row.title?.trim()) {
      t.title = row.title.trim().slice(0, 48);
    }
  }
  return topics;
}

function mergeNarrative(data: ReportData, parsed: LlmJsonShape, base: RoomNarrative): RoomNarrative {
  const llmParas = (parsed.paragraphs ?? []).filter((p) => p.trim().length > 8).slice(0, 3);
  if (llmParas.length === 0) return base;
  const merged = [...llmParas, ...base.paragraphs.slice(0, 2)];
  return {
    ogSummary: base.ogSummary,
    paragraphs: merged.slice(0, 5),
  };
}

/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export async function applyLlmEnrichment(
  data: ReportData,
  options?: BuildReportOptions,
  messageCount?: number,
): Promise<LlmEnrichmentResult> {
  const preset = resolvePresetNameWithAuto(options, messageCount ?? data.summary.totalMessages);
  const profile = probeMachineProfileSync();
  const plan = resolveLlmRunPlan({ preset, profile, messageCount });
  if (!plan.enabled || !plan.size) {
    return { used: false, plan };
  }

  const raw = await runLlmCompletion(data, plan);
  if (!raw) return { used: false, plan };

  const parsed = parseLlmJson(raw);
  if (!parsed) {
    process.stderr.write("[kca] LLM JSON 파싱 실패 — 규칙 기반 서사 유지\n");
    return { used: false, plan };
  }

  let topics = mergeTopics(data, parsed);
  topics = mergeTopicProposals(topics, parsed.topicProposals, data.keywords, data.summary.totalMessages);
  const narrative = mergeNarrative(data, parsed, data.narrative);
  const llmInsights = mergeLlmInsights(parsed, parsed.topicProposals);

  return { used: true, plan, topics, narrative, llmInsights };
}

function mergeLlmInsights(
  parsed: LlmJsonShape,
  proposals?: LlmTopicProposal[],
): LlmInsights | undefined {
  const insightBullets = (parsed.insightBullets ?? []).filter((s) => s.trim().length > 4).slice(0, 5);
  const shopSearchSummary = parsed.shopSearchSummary?.trim().slice(0, 200);
  const dyadInsight = parsed.dyadInsight?.trim().slice(0, 200);
  const topicProposals = (proposals ?? [])
    .filter((p) => p.title?.trim())
    .slice(0, 4)
    .map((p) => ({
      title: p.title.trim().slice(0, 48),
      terms: (p.terms ?? p.keywordEvidence ?? []).slice(0, 6),
    }));
  if (!insightBullets.length && !shopSearchSummary && !dyadInsight && !topicProposals.length) {
    return undefined;
  }
  return { insightBullets, shopSearchSummary, dyadInsight, topicProposals };
}

/** @deprecated use applyLlmEnrichment */
export async function summarizeTopicsWithLlm(
  preset: AnalysisPresetName,
  topics: string[],
  sampleLines: string[],
): Promise<null> {
  void preset;
  void topics;
  void sampleLines;
  return null;
}
