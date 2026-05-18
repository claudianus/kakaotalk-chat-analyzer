import { stat } from "node:fs/promises";
import { buildLlmPromptPayload, LLM_SYSTEM_PROMPT } from "./llm-input.js";
import { ggufPathForTier } from "./llm-cache.js";
import { llmTimeoutMs, resolveLlmTier } from "./llm-policy.js";
import { probeMachineProfileSync } from "./analysis-capability.js";
import { resolvePresetNameWithAuto } from "./analysis-preset.js";
import { mergeTopicProposals } from "./topic-merge.js";
function parseLlmJson(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start)
        return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    }
    catch {
        return null;
    }
}
async function runOllama(prompt, tier, timeoutMs) {
    const host = process.env.KCA_OLLAMA_HOST?.trim() || "http://127.0.0.1:11434";
    const model = process.env.KCA_OLLAMA_MODEL?.trim() ||
        (tier === "8b"
            ? "qwen3:8b"
            : tier === "4b"
                ? "qwen2.5:7b"
                : tier === "2b"
                    ? "qwen2.5:3b"
                    : "qwen2.5:0.5b");
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
        if (!res.ok)
            throw new Error(`Ollama HTTP ${res.status}`);
        const json = (await res.json());
        return json.response ?? "";
    }
    finally {
        clearTimeout(timer);
    }
}
async function runNodeLlama(prompt, tier, timeoutMs) {
    const modelPath = ggufPathForTier(tier);
    try {
        await stat(modelPath);
    }
    catch {
        throw new Error(`GGUF 없음: ${modelPath} (kca llm pull ${tier})`);
    }
    const mod = "node-llama-cpp";
    const { getLlama, LlamaChatSession } = await import(mod);
    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath });
    const context = await model.createContext({ contextSize: 4096 });
    const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
    });
    const fullPrompt = `${LLM_SYSTEM_PROMPT}\n\n---\n\n${prompt}`;
    let reply = "";
    const run = session.prompt(fullPrompt, { maxTokens: 768 });
    const timed = Promise.race([
        run,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error("LLM timeout")), timeoutMs);
        }),
    ]);
    reply = await timed;
    await context.dispose?.();
    await model.dispose?.();
    return typeof reply === "string" ? reply : String(reply);
}
async function runMockLlm() {
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
export async function runLlmCompletion(data, tier) {
    const prompt = buildLlmPromptPayload(data);
    const timeoutMs = tier === "8b" ? 90_000 : tier === "4b" ? 60_000 : llmTimeoutMs();
    try {
        if (process.env.KCA_LLM_MOCK === "1") {
            return runMockLlm();
        }
        if (process.env.KCA_LLM_BACKEND?.trim().toLowerCase() === "ollama") {
            return await runOllama(prompt, tier, timeoutMs);
        }
        return await runNodeLlama(prompt, tier, timeoutMs);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(`[kca] LLM 건너뜀: ${msg}\n`);
        return null;
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
    const llmParas = (parsed.paragraphs ?? []).filter((p) => p.trim().length > 8).slice(0, 3);
    if (llmParas.length === 0)
        return base;
    const merged = [...llmParas, ...base.paragraphs.slice(0, 2)];
    return {
        ogSummary: base.ogSummary,
        paragraphs: merged.slice(0, 5),
    };
}
/** quality 등 preset에서 LLM 서사·주제 보강 */
export async function applyLlmEnrichment(data, options, messageCount) {
    const preset = resolvePresetNameWithAuto(options, messageCount ?? data.summary.totalMessages);
    const profile = probeMachineProfileSync();
    const tier = resolveLlmTier(preset, profile);
    if (tier === "off")
        return { used: false, tier };
    if (process.env.KCA_LLM === "0")
        return { used: false, tier };
    const raw = await runLlmCompletion(data, tier);
    if (!raw)
        return { used: false, tier };
    const parsed = parseLlmJson(raw);
    if (!parsed) {
        process.stderr.write("[kca] LLM JSON 파싱 실패 — 규칙 기반 서사 유지\n");
        return { used: false, tier };
    }
    let topics = mergeTopics(data, parsed);
    topics = mergeTopicProposals(topics, parsed.topicProposals, data.keywords, data.summary.totalMessages);
    const narrative = mergeNarrative(data, parsed, data.narrative);
    const llmInsights = mergeLlmInsights(parsed, parsed.topicProposals);
    return { used: true, tier, topics, narrative, llmInsights };
}
function mergeLlmInsights(parsed, proposals) {
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
export async function summarizeTopicsWithLlm(preset, topics, sampleLines) {
    void preset;
    void topics;
    void sampleLines;
    return null;
}
//# sourceMappingURL=llm-summarize.js.map