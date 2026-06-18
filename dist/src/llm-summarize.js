import { stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { assembleLlmUserPrompt, buildLlmSystemPrompt } from "./llm-input.js";
import { ggufPathForSize } from "./llm-cache.js";
import { llmInferTimeoutMs, llmLoadTimeoutMs, resolveLlmRunPlan, } from "./llm-policy.js";
import { ensureLlmGgufReady } from "./llm-ensure.js";
import { downgradeQwen35Size, qwen35DisplayLabel, } from "./llm-qwen35.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { parseLlmJsonResponse } from "./llm-json.js";
import { mergeTopicProposals } from "./topic-merge.js";
import { isLlmGarbageText, mergeLlmValidationAudits, sanitizeLlmDeckWithAudit, sanitizeLlmParagraphsWithAudit, textHasLlmEvidence, } from "./llm-deck-validate.js";
import { buildKcaLlmJsonSchemaTier, resolveLlmSchemaTier } from "./llm-schema.js";
import { isLlmMockEnabled, runLlmMockCompletion } from "./llm-mock.js";
import { resolveLlmGpuForInfer } from "./llm-gpu-policy.js";
import { runLlamaPrompt, LlmInferProcessError } from "./llm-runtime.js";
import { resolveLlmMaxTokens, resolveLlmSamplingForStructured } from "./llm-llama-core.js";
function debugLlmRaw(raw, label) {
    if (process.env.KCA_DEBUG_LLM !== "1")
        return;
    const tail = raw.slice(-500);
    process.stderr.write(`[kca] LLM debug (${label}, tail ${tail.length} chars):\n${tail}\n`);
}
async function runOllama(systemPrompt, userPrompt, plan, size, timeoutMs, sampling) {
    const host = process.env.KCA_OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
    const model = process.env.KCA_OLLAMA_MODEL?.trim() || plan.ollamaModel;
    if (!model)
        throw new Error("Ollama model 미설정");
    const body = {
        model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        format: "json",
        options: { num_predict: resolveLlmMaxTokens(), temperature: sampling.temperature, top_p: sampling.topP },
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
async function runNodeLlamaOnce(data, size, plan, gpu, llmOpts) {
    const ready = await ensureLlmGgufReady(size);
    const modelPath = ggufPathForSize(size);
    if (!ready) {
        throw new Error(`Qwen3.5 GGUF 없음: ${modelPath} (kca llm pull 또는 네트워크 확인)`);
    }
    await stat(modelPath);
    const repairAttempt = !!llmOpts?.repairFeedback?.trim();
    const schemaTier = resolveLlmSchemaTier({
        modelSize: size,
        compact: llmOpts?.compact ?? false,
        repairAttempt,
    });
    const systemPrompt = buildLlmSystemPrompt({ tier: schemaTier, size });
    const userPrompt = assembleLlmUserPrompt(data, {
        compact: llmOpts?.compact,
        repairFeedback: llmOpts?.repairFeedback,
        schemaTier,
    });
    const sampling = resolveLlmSamplingForStructured({
        size,
        repairAttempt,
        override: llmOpts?.temperature !== undefined ? { temperature: llmOpts.temperature } : undefined,
    });
    return runLlamaPrompt({
        modelPath,
        systemPrompt,
        prompt: userPrompt,
        maxTokens: resolveLlmMaxTokens(),
        loadTimeoutMs: llmLoadTimeoutMs(size),
        inferTimeoutMs: llmInferTimeoutMs(size, plan),
        gpu,
        grammarJsonSchema: buildKcaLlmJsonSchemaTier(schemaTier),
        sampling,
    });
}
async function runNodeLlama(data, size, plan, singleShot) {
    if (singleShot) {
        return runNodeLlamaOnce(data, size, plan, singleShot.gpu, singleShot.llmOpts);
    }
    const attempts = buildLlamaInferAttempts(size);
    let lastError = "LLM 추론 실패";
    for (let i = 0; i < attempts.length; i += 1) {
        const att = attempts[i];
        try {
            const text = await runNodeLlamaOnce(data, att.size, plan, att.gpu);
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
    const repairAttempt = !!opts?.repairFeedback?.trim();
    const schemaTier = resolveLlmSchemaTier({
        modelSize: size,
        compact: opts?.compact ?? false,
        repairAttempt,
    });
    const systemPrompt = buildLlmSystemPrompt({ tier: schemaTier, size });
    const userPrompt = assembleLlmUserPrompt(data, {
        compact: opts?.compact,
        repairFeedback: opts?.repairFeedback,
        schemaTier,
    });
    const sampling = resolveLlmSamplingForStructured({
        size,
        repairAttempt,
        override: opts?.temperature !== undefined ? { temperature: opts.temperature } : undefined,
    });
    const inferMs = llmInferTimeoutMs(size, plan);
    const started = performance.now();
    try {
        let raw;
        if (isLlmMockEnabled()) {
            raw = await runLlmMockCompletion();
        }
        else if (process.env.KCA_LLM_BACKEND?.trim().toLowerCase() === "ollama") {
            raw = await runOllama(systemPrompt, userPrompt, plan, size, inferMs + llmLoadTimeoutMs(size), sampling);
        }
        else {
            const singleShot = opts?.harnessSingleShot && opts.gpuOverride
                ? {
                    gpu: opts.gpuOverride,
                    llmOpts: {
                        compact: opts.compact,
                        repairFeedback: opts.repairFeedback,
                        temperature: opts.temperature,
                    },
                }
                : opts?.harnessSingleShot
                    ? {
                        gpu: resolveLlmGpuForInfer(probeMachineProfileSync(), size),
                        llmOpts: {
                            compact: opts.compact,
                            repairFeedback: opts.repairFeedback,
                            temperature: opts.temperature,
                        },
                    }
                    : undefined;
            raw = await runNodeLlama(data, size, plan, singleShot);
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
        const title = row.title?.trim();
        if (t && title && !isLlmGarbageText(title) && textHasLlmEvidence(`${title} ${t.terms.join(" ")}`, data)) {
            t.title = title.slice(0, 48);
        }
    }
    return topics;
}
function mergeNarrative(data, parsed, base) {
    const { paragraphs: llmParas, audit } = sanitizeLlmParagraphsWithAudit(parsed.paragraphs, data);
    if (llmParas.length === 0)
        return { narrative: base, audit };
    const merged = [...llmParas, ...base.paragraphs.slice(0, 2)];
    return {
        narrative: {
            ogSummary: base.ogSummary,
            paragraphs: merged.slice(0, 5),
        },
        audit,
    };
}
function mergeLlmInsights(data, parsed, proposals) {
    const insightBullets = (parsed.insightBullets ?? [])
        .filter((s) => s.trim().length > 4 && !isLlmGarbageText(s) && textHasLlmEvidence(s, data))
        .slice(0, 5);
    const rawShop = parsed.shopSearchSummary?.trim().slice(0, 200);
    const shopSearchSummary = rawShop && !isLlmGarbageText(rawShop) && textHasLlmEvidence(rawShop, data) ? rawShop : undefined;
    const rawDyad = parsed.dyadInsight?.trim().slice(0, 200);
    const dyadInsight = rawDyad && !isLlmGarbageText(rawDyad) && textHasLlmEvidence(rawDyad, data) ? rawDyad : undefined;
    const topicProposals = (proposals ?? [])
        .filter((p) => p.title?.trim() && textHasLlmEvidence(`${p.title} ${(p.terms ?? p.keywordEvidence ?? []).join(" ")}`, data))
        .slice(0, 4)
        .map((p) => ({
        title: p.title.trim().slice(0, 48),
        terms: (p.terms ?? p.keywordEvidence ?? []).slice(0, 6),
    }));
    const { insights: deck, audit: deckAudit } = sanitizeLlmDeckWithAudit(parsed, data);
    const acceptedInline = insightBullets.length +
        (shopSearchSummary ? 1 : 0) +
        (dyadInsight ? 1 : 0) +
        topicProposals.length;
    const droppedInline = Math.max(0, (parsed.insightBullets ?? []).length - insightBullets.length) +
        (rawShop && !shopSearchSummary ? 1 : 0) +
        (rawDyad && !dyadInsight ? 1 : 0) +
        Math.max(0, (proposals ?? []).length - topicProposals.length);
    const audit = mergeLlmValidationAudits(deckAudit, {
        acceptedClaims: acceptedInline,
        droppedClaims: droppedInline,
        fallbackUsed: false,
        validationWarnings: droppedInline > 0 ? ["unsupported_inline_insight"] : [],
    });
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
        return { llmInsights: undefined, audit };
    return { llmInsights: merged, audit };
}
function toHarnessQuality(audit, args) {
    return {
        schemaValid: args?.schemaValid ?? true,
        acceptedClaims: audit.acceptedClaims,
        droppedClaims: audit.droppedClaims,
        repairAttempts: args?.repairAttempts ?? 0,
        fallbackUsed: audit.fallbackUsed,
        validationWarnings: audit.validationWarnings.slice(0, 12),
    };
}
export function buildEnrichmentFromParsed(data, parsed, plan, repairAttempts = 0) {
    let topics = mergeTopics(data, parsed);
    topics = mergeTopicProposals(topics, parsed.topicProposals, data.keywords, data.summary.totalMessages);
    const narrativeResult = mergeNarrative(data, parsed, data.narrative);
    const insightsResult = mergeLlmInsights(data, parsed, parsed.topicProposals);
    const audit = mergeLlmValidationAudits(narrativeResult.audit, insightsResult.audit);
    return {
        used: true,
        plan,
        topics,
        narrative: narrativeResult.narrative,
        llmInsights: insightsResult.llmInsights,
        llmQuality: toHarnessQuality(audit, { repairAttempts }),
    };
}
export function parseCompletionRaw(raw) {
    return parseLlmJsonResponse(raw, null);
}
export function schemaFailureQuality(repairAttempts = 0) {
    return {
        schemaValid: false,
        acceptedClaims: 0,
        droppedClaims: 0,
        repairAttempts,
        fallbackUsed: false,
        validationWarnings: ["schema_or_json_parse_failed"],
    };
}
export function llmRetryBudgetSkipReason(budget) {
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
        const { runLlmHarness } = await import("./llm-harness.js");
        return await runLlmHarness(data, plan, budget);
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