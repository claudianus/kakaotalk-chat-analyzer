import { stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { buildLlmPromptPayload, LLM_SYSTEM_PROMPT } from "./llm-input.js";
import { ggufPathForSize } from "./llm-cache.js";
import { llmInferTimeoutMs, llmLoadTimeoutMs, resolveLlmRunPlan, canRetryLlmRam, minFreeGbForLlmRetry, } from "./llm-policy.js";
import { ensureLlmGgufReady } from "./llm-ensure.js";
import { downgradeQwen35Size, qwen35DisplayLabel, qwen35Entry, } from "./llm-qwen35.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { parseLlmJsonResponse } from "./llm-json.js";
import { mergeTopicProposals } from "./topic-merge.js";
import { sanitizeLlmDeck, isLlmGarbageText } from "./llm-deck-validate.js";
import { buildKcaLlmJsonSchema } from "./llm-schema.js";
import { resolveLlmGpuForInfer } from "./llm-gpu-policy.js";
import { runLlamaPrompt, LlmInferProcessError } from "./llm-runtime.js";
function debugLlmRaw(raw, label) {
    if (process.env.KCA_DEBUG_LLM !== "1")
        return;
    const tail = raw.slice(-500);
    process.stderr.write(`[kca] LLM debug (${label}, tail ${tail.length} chars):\n${tail}\n`);
}
async function runOllama(prompt, plan, size, timeoutMs) {
    const host = process.env.KCA_OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
    const model = process.env.KCA_OLLAMA_MODEL?.trim() || plan.ollamaModel;
    if (!model)
        throw new Error("Ollama model 미설정");
    const body = {
        model,
        prompt: `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`,
        stream: false,
        format: "json",
        options: { num_predict: 768, temperature: 0.7, top_p: 0.8 },
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
        if (!res.ok)
            throw new Error(`Ollama HTTP ${res.status}`);
        const json = (await res.json());
        return json.response ?? "";
    }
    finally {
        clearTimeout(timer);
    }
}
function buildLlamaInferAttempts(size) {
    const profile = probeMachineProfileSync();
    const primaryGpu = resolveLlmGpuForInfer(profile, size);
    const attempts = [{ size, gpu: primaryGpu, label: "primary" }];
    if (primaryGpu !== "none") {
        attempts.push({ size, gpu: "none", label: "cpu-fallback" });
    }
    let next = downgradeQwen35Size(size);
    while (next) {
        attempts.push({ size: next, gpu: "none", label: `downgrade-${next}` });
        next = downgradeQwen35Size(next);
    }
    return attempts;
}
async function runNodeLlamaOnce(prompt, size, plan, gpu) {
    const ready = await ensureLlmGgufReady(size);
    const modelPath = ggufPathForSize(size);
    if (!ready) {
        throw new Error(`Qwen3.5 GGUF 없음: ${modelPath} (kca llm pull 또는 네트워크 확인)`);
    }
    await stat(modelPath);
    const fullPrompt = `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`;
    return runLlamaPrompt({
        modelPath,
        prompt: fullPrompt,
        maxTokens: 768,
        loadTimeoutMs: llmLoadTimeoutMs(size),
        inferTimeoutMs: llmInferTimeoutMs(size, plan),
        gpu,
        grammarJsonSchema: buildKcaLlmJsonSchema(),
    });
}
async function runNodeLlama(prompt, size, plan) {
    const attempts = buildLlamaInferAttempts(size);
    let lastError = "LLM 추론 실패";
    for (let i = 0; i < attempts.length; i += 1) {
        const att = attempts[i];
        try {
            const text = await runNodeLlamaOnce(prompt, att.size, plan, att.gpu);
            if (att.label !== "primary") {
                const gpuNote = att.gpu === "none" ? "CPU" : att.gpu;
                process.stderr.write(`[kca] LLM 재시도 성공 (${qwen35DisplayLabel(att.size)}, ${gpuNote}, ${att.label})\n`);
            }
            return text;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            lastError = msg;
            const isLast = i === attempts.length - 1;
            if (isLast)
                break;
            if (error instanceof LlmInferProcessError && error.kind === "segfault") {
                process.stderr.write(`[kca] LLM 네이티브 크래시 (${qwen35DisplayLabel(att.size)}) → ${attempts[i + 1]?.label ?? "skip"}\n`);
            }
            else {
                process.stderr.write(`[kca] LLM 실패 (${qwen35DisplayLabel(att.size)}, ${att.label}): ${msg.slice(0, 120)} → 재시도\n`);
            }
        }
    }
    throw new Error(lastError);
}
async function runMockLlm() {
    if (process.env.KCA_LLM_MOCK === "invalid") {
        return "서사만 한국어로 씁니다. JSON 아님.";
    }
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
        roomArchetype: {
            name: "야근 크루",
            description: "밤에 몰아 치는 개발·AI 잡담 방",
            traits: ["심야", "키워드 집중", "응답 빠름"],
        },
        moments: [{ headline: "가장 바빴던 순간", statRef: "10000" }],
        relationshipBeats: [{ pair: "A→B", beat: "질문을 던지고 답을 받는 허브", role: "질문러" }],
        episodeCards: [
            { period: "1막", title: "첫 불꽃", tagline: "키워드가 모이기 시작", emoji: "🔥" },
        ],
        eraLabels: [{ label: "1막: 초반 키워드", detail: "후반과 다른 화제" }],
        shareLine: "우리 방 올해의 대화 리듬을 숫자로 정리했어요",
        hashtags: ["카톡리포트", "kca", "대화통계"],
    });
}
function classifyError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("GGUF 없음"))
        return { code: "gguf_missing", message: msg };
    if (msg.includes("timeout") || msg.includes("abort"))
        return { code: "timeout", message: msg };
    return { code: "inference_error", message: msg };
}
export async function runLlmCompletion(data, plan, opts) {
    if (!plan.enabled) {
        return {
            ok: false,
            skipReason: plan.reason,
            code: "disabled",
            size: opts?.sizeOverride ?? plan.size ?? "0.8B",
            elapsedMs: 0,
        };
    }
    const size = opts?.sizeOverride ?? plan.size;
    if (!size) {
        return {
            ok: false,
            skipReason: plan.reason,
            code: "disabled",
            size: "0.8B",
            elapsedMs: 0,
        };
    }
    const prompt = buildLlmPromptPayload(data, { compact: opts?.compact });
    const inferMs = llmInferTimeoutMs(size, plan);
    const started = performance.now();
    try {
        let raw;
        if (process.env.KCA_LLM_MOCK === "1" || process.env.KCA_LLM_MOCK === "invalid") {
            raw = await runMockLlm();
        }
        else if (process.env.KCA_LLM_BACKEND?.trim().toLowerCase() === "ollama") {
            raw = await runOllama(prompt, plan, size, inferMs + llmLoadTimeoutMs(size));
        }
        else {
            raw = await runNodeLlama(prompt, size, plan);
        }
        const elapsedMs = Math.round(performance.now() - started);
        debugLlmRaw(raw, `${qwen35DisplayLabel(size)} ok ${elapsedMs}ms`);
        return { ok: true, raw, size, elapsedMs };
    }
    catch (error) {
        const elapsedMs = Math.round(performance.now() - started);
        const { code, message } = classifyError(error);
        const skipReason = code === "timeout"
            ? `추론 타임아웃 (${qwen35DisplayLabel(size)}, ${elapsedMs}ms, 상한 load ${llmLoadTimeoutMs(size)}ms + infer ${inferMs}ms)`
            : code === "gguf_missing"
                ? message
                : `추론 실패 (${qwen35DisplayLabel(size)}, ${elapsedMs}ms): ${message}`;
        process.stderr.write(`[kca] LLM 건너뜀 — ${skipReason}\n`);
        return { ok: false, skipReason, code, size, elapsedMs };
    }
}
function mergeTopics(data, parsed) {
    const topics = data.topics.map((t) => ({ ...t }));
    for (const row of parsed.topicTitles ?? []) {
        const t = topics[row.i];
        if (t && row.title?.trim()) {
            t.title = row.title.trim().slice(0, 48);
        }
    }
    return topics;
}
function mergeNarrative(data, parsed, base) {
    const llmParas = (parsed.paragraphs ?? [])
        .filter((p) => p.trim().length > 8 && !isLlmGarbageText(p))
        .slice(0, 3);
    if (llmParas.length === 0)
        return base;
    const merged = [...llmParas, ...base.paragraphs.slice(0, 2)];
    return {
        ogSummary: base.ogSummary,
        paragraphs: merged.slice(0, 5),
    };
}
function mergeLlmInsights(data, parsed, proposals) {
    const insightBullets = (parsed.insightBullets ?? [])
        .filter((s) => s.trim().length > 4 && !isLlmGarbageText(s))
        .slice(0, 5);
    const rawShop = parsed.shopSearchSummary?.trim().slice(0, 200);
    const shopSearchSummary = rawShop && !isLlmGarbageText(rawShop) ? rawShop : undefined;
    const rawDyad = parsed.dyadInsight?.trim().slice(0, 200);
    const dyadInsight = rawDyad && !isLlmGarbageText(rawDyad) ? rawDyad : undefined;
    const topicProposals = (proposals ?? [])
        .filter((p) => p.title?.trim())
        .slice(0, 4)
        .map((p) => ({
        title: p.title.trim().slice(0, 48),
        terms: (p.terms ?? p.keywordEvidence ?? []).slice(0, 6),
    }));
    const deck = sanitizeLlmDeck(parsed, data);
    const merged = {
        insightBullets,
        shopSearchSummary,
        dyadInsight,
        topicProposals,
        ...deck,
    };
    const hasContent = insightBullets.length ||
        shopSearchSummary ||
        dyadInsight ||
        topicProposals.length ||
        Object.keys(deck).length > 0;
    if (!hasContent)
        return undefined;
    return merged;
}
function buildEnrichmentFromParsed(data, parsed, plan) {
    let topics = mergeTopics(data, parsed);
    topics = mergeTopicProposals(topics, parsed.topicProposals, data.keywords, data.summary.totalMessages);
    const narrative = mergeNarrative(data, parsed, data.narrative);
    const llmInsights = mergeLlmInsights(data, parsed, parsed.topicProposals);
    return { used: true, plan, topics, narrative, llmInsights };
}
function parseCompletionRaw(raw) {
    return parseLlmJsonResponse(raw, null);
}
function llmRetryBudgetSkipReason(budget) {
    if (!budget?.shouldSkip("llm_retry"))
        return undefined;
    const remainSec = Math.round(budget.remainingMs() / 1000);
    return `예산 부족 (LLM 재시도, 남은 ~${remainSec}s)`;
}
/** preset·RAM 기준 Qwen3.5 자동 선택 후 서사·주제 보강 */
export async function applyLlmEnrichment(data, options, messageCount, ctx) {
    const preset = resolvePresetNameWithAuto(options, messageCount ?? data.summary.totalMessages);
    const profile = probeMachineProfileSync();
    const plan = ctx?.llmPlan ??
        resolveLlmRunPlan({ preset, profile, messageCount, postMl: true });
    const budget = ctx?.budget;
    if (!plan.enabled || !plan.size) {
        return { used: false, plan, skipReason: plan.reason };
    }
    try {
        const primary = await runLlmCompletion(data, plan);
        if (primary.ok) {
            const parsed = parseCompletionRaw(primary.raw);
            if (parsed)
                return buildEnrichmentFromParsed(data, parsed, plan);
            process.stderr.write(`[kca] LLM JSON 파싱 실패 (${qwen35DisplayLabel(primary.size)}, ${primary.elapsedMs}ms) — compact 재시도\n`);
            debugLlmRaw(primary.raw, "parse_fail primary");
            const reprobe = probeMachineProfileSync();
            if (!canRetryLlmRam(reprobe, primary.size)) {
                const skipReason = `JSON 파싱 실패 (${qwen35DisplayLabel(primary.size)}, ${primary.elapsedMs}ms); 재시도 건너뜀 (free ${reprobe.freeMemGb}GB < ${minFreeGbForLlmRetry()}GB)`;
                process.stderr.write(`[kca] LLM ${skipReason} — 규칙 기반 서사 유지\n`);
                return { used: false, plan, skipReason };
            }
            const budgetSkip = llmRetryBudgetSkipReason(budget);
            if (budgetSkip) {
                process.stderr.write(`[kca] LLM ${budgetSkip} — 규칙 기반 서사 유지\n`);
                return { used: false, plan, skipReason: budgetSkip };
            }
            const retry = await runLlmCompletion(data, plan, {
                compact: true,
                sizeOverride: primary.size,
            });
            if (!retry.ok) {
                return { used: false, plan, skipReason: retry.skipReason };
            }
            const parsedRetry = parseCompletionRaw(retry.raw);
            if (!parsedRetry) {
                debugLlmRaw(retry.raw, "parse_fail retry");
                return {
                    used: false,
                    plan,
                    skipReason: `JSON 파싱 실패 (${qwen35DisplayLabel(retry.size)}, ${retry.elapsedMs}ms)`,
                };
            }
            process.stderr.write(`[kca] LLM compact 재시도 성공 (${qwen35DisplayLabel(retry.size)}, ${retry.elapsedMs}ms)\n`);
            return buildEnrichmentFromParsed(data, parsedRetry, plan);
        }
        if (primary.code !== "timeout") {
            return { used: false, plan, skipReason: primary.skipReason };
        }
        if (plan.size === "0.8B") {
            return { used: false, plan, skipReason: primary.skipReason };
        }
        const reprobe = probeMachineProfileSync();
        const retrySize = "0.8B";
        if (!canRetryLlmRam(reprobe, retrySize)) {
            return {
                used: false,
                plan,
                skipReason: `${primary.skipReason}; 재시도 건너뜀 (free ${reprobe.freeMemGb}GB)`,
            };
        }
        const budgetSkip = llmRetryBudgetSkipReason(budget);
        if (budgetSkip) {
            return { used: false, plan, skipReason: `${primary.skipReason}; ${budgetSkip}` };
        }
        const retryPlan = {
            ...plan,
            size: retrySize,
            reason: `${plan.reason} → 재시도 ${qwen35DisplayLabel(retrySize)} compact (timeout)`,
            timeoutMs: qwen35Entry(retrySize).timeoutMs,
        };
        const retry = await runLlmCompletion(data, retryPlan, {
            compact: true,
            sizeOverride: retrySize,
        });
        if (!retry.ok) {
            return {
                used: false,
                plan,
                skipReason: `${primary.skipReason}; 재시도: ${retry.skipReason}`,
            };
        }
        const parsedRetry = parseCompletionRaw(retry.raw);
        if (!parsedRetry) {
            process.stderr.write(`[kca] LLM JSON 파싱 실패 (${qwen35DisplayLabel(retrySize)}, ${retry.elapsedMs}ms) — 규칙 기반 서사 유지\n`);
            debugLlmRaw(retry.raw, "parse_fail timeout retry");
            return {
                used: false,
                plan,
                skipReason: `JSON 파싱 실패 (${qwen35DisplayLabel(retrySize)}, ${retry.elapsedMs}ms)`,
            };
        }
        return buildEnrichmentFromParsed(data, parsedRetry, plan);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[kca] LLM 건너뜀 — ${msg}\n`);
        return { used: false, plan, skipReason: `LLM 오류: ${msg}` };
    }
}
/** @deprecated use applyLlmEnrichment */
export async function summarizeTopicsWithLlm(preset, topics, sampleLines) {
    void preset;
    void topics;
    void sampleLines;
    return null;
}
//# sourceMappingURL=llm-summarize.js.map