import { analysisBudgetMs, probeMachineProfileSync, } from "./analysis-capability.js";
import { autoPresetFromMachine, getPresetEffectiveFlags, presetForcesSemanticOff, presetForcesSentimentOff, resolvePresetName, resolvePresetNameWithAuto, } from "./analysis-preset.js";
import { getAnalysisProfileSettings } from "./analysis-profile.js";
import { resolveLlmTier, qwenModelIdForTier } from "./llm-policy.js";
import { parseKcaInvokerEnv } from "./report-provenance.js";
import { resolveTopicModel } from "./report-provenance.js";
import { effectiveSemanticSampleCap, semanticEmbeddingModelId, } from "./semantic-policy.js";
import { sentimentModelId } from "./sentiment-policy.js";
function collectEnvOverrides() {
    const keys = [
        "KCA_PRESET",
        "KCA_PROFILE",
        "KCA_NO_SEMANTIC",
        "KCA_SEMANTIC",
        "KCA_SEMANTIC_DEFAULT",
        "KCA_SEMANTIC_MODEL",
        "KCA_NO_SENTIMENT",
        "KCA_SENTIMENT",
        "KCA_SENTIMENT_DEFAULT",
        "KCA_SENTIMENT_MODEL",
        "KCA_LLM",
        "KCA_LLM_MODEL",
        "KCA_LLM_MOCK",
        "KCA_LLM_BACKEND",
        "KCA_EMBEDDING_TOPICS",
        "KCA_INVOKER",
    ];
    const out = [];
    for (const key of keys) {
        const v = process.env[key];
        if (v !== undefined && v !== "")
            out.push(`${key}=${v}`);
    }
    return out;
}
export function resolvePresetSource(cliPreset, worker, messageCount, machine) {
    if (worker === true || process.env.KCA_PROFILE === "fast")
        return "legacy-fast";
    if (cliPreset)
        return "cli";
    const env = process.env.KCA_PRESET?.trim().toLowerCase();
    if (env === "speed" || env === "balanced" || env === "quality" || env === "custom")
        return "env";
    const auto = autoPresetFromMachine(machine, messageCount);
    const ramOnly = autoPresetFromMachine(machine, 0);
    if (auto !== ramOnly)
        return "auto-corpus";
    return "auto-ram";
}
function presetSourceLabel(source) {
    const labels = {
        cli: "CLI --preset",
        env: "환경 변수 KCA_PRESET",
        "auto-ram": "RAM 기준 자동",
        "auto-corpus": "RAM·메시지 수 기준 자동",
        "legacy-fast": "CLI --fast / KCA_PROFILE=fast",
    };
    return labels[source];
}
function resolveWorkerRequested(worker) {
    if (worker === false)
        return false;
    if (worker === true)
        return true;
    return "auto";
}
function resolveSemanticRequested(semanticKeywords) {
    if (semanticKeywords === false)
        return false;
    if (semanticKeywords === true)
        return true;
    return "auto";
}
function resolveSentimentRequested(sentiment) {
    if (sentiment === false)
        return false;
    if (sentiment === true)
        return true;
    return "auto";
}
function inferSemanticSkipReason(options, preset, used) {
    if (used)
        return undefined;
    if (process.env.KCA_NO_SEMANTIC === "1")
        return "KCA_NO_SEMANTIC=1";
    if (options?.semanticKeywords === false)
        return "CLI --no-semantic-keywords";
    if (presetForcesSemanticOff(options))
        return `${preset} preset`;
    if (process.env.KCA_SEMANTIC === "0")
        return "KCA_SEMANTIC=0";
    if (process.env.KCA_SEMANTIC_DEFAULT === "opt-in")
        return "KCA_SEMANTIC_DEFAULT=opt-in";
    if (options?.semanticKeywords !== true && process.env.KCA_SEMANTIC !== "1") {
        return "auto: 한국어 비중·샘플 조건 미충족 또는 실행 중 오류";
    }
    return "실행 중 오류 또는 샘플 부족";
}
function inferSentimentSkipReason(options, preset, used) {
    if (used)
        return undefined;
    if (process.env.KCA_NO_SENTIMENT === "1")
        return "KCA_NO_SENTIMENT=1";
    if (options?.sentiment === false)
        return "CLI --no-sentiment";
    if (presetForcesSentimentOff(options))
        return `${preset} preset`;
    if (process.env.KCA_SENTIMENT === "0")
        return "KCA_SENTIMENT=0";
    if (process.env.KCA_SENTIMENT_DEFAULT === "opt-in")
        return "KCA_SENTIMENT_DEFAULT=opt-in";
    if (options?.sentiment !== true && process.env.KCA_SENTIMENT !== "1") {
        return "auto: 한국어 비중·샘플 조건 미충족 또는 실행 중 오류";
    }
    return "실행 중 오류 또는 샘플 부족";
}
function inferLlmSkipReason(preset, tier, used, profile) {
    if (used)
        return undefined;
    if (process.env.KCA_LLM === "0")
        return "KCA_LLM=0";
    if (tier !== "off") {
        return "GGUF 없음·예산 부족·추론 실패 또는 JSON 파싱 실패";
    }
    if (preset === "speed" || preset === "balanced") {
        return `${preset} preset (KCA_LLM=1 없음)`;
    }
    if (preset === "custom" && process.env.KCA_LLM !== "1")
        return "custom preset (KCA_LLM=1 필요)";
    if (profile.freeMemGb < 8)
        return `여유 RAM ${profile.freeMemGb}GB (< 8GB)`;
    return "LLM tier off";
}
/** 집계 완료 후 실제 적용 설정 */
export function buildAnalysisEffectiveConfig(data, cli, machine) {
    const profileMachine = machine ?? probeMachineProfileSync();
    const buildOpts = {
        preset: cli.preset,
        worker: cli.worker,
        semanticKeywords: cli.semanticKeywords,
        sentiment: cli.sentiment,
        since: cli.since,
    };
    const messageCount = data.summary.totalMessages;
    const preset = resolvePresetNameWithAuto(buildOpts, messageCount);
    const presetSource = resolvePresetSource(cli.preset, cli.worker, messageCount, profileMachine);
    const flags = getPresetEffectiveFlags(buildOpts, messageCount);
    const profileSettings = getAnalysisProfileSettings(buildOpts);
    const semanticModel = semanticEmbeddingModelId(buildOpts, messageCount);
    const sentimentModel = sentimentModelId(preset);
    const semanticCap = effectiveSemanticSampleCap(messageCount, buildOpts);
    const llmTier = resolveLlmTier(preset, profileMachine);
    const semanticUsed = data.summary.usedSemanticKeywords === true;
    const sentimentUsed = data.summary.usedSentimentAnalysis === true;
    const llmUsed = data.summary.usedLlmAnalysis === true;
    return {
        preset,
        presetSource,
        profile: flags.profile,
        privacy: cli.privacy,
        top: cli.top,
        since: cli.since,
        workerRequested: resolveWorkerRequested(cli.worker),
        workerUsed: false,
        semantic: {
            requested: resolveSemanticRequested(cli.semanticKeywords),
            used: semanticUsed,
            model: semanticModel,
            sampleCap: semanticCap,
            skippedReason: inferSemanticSkipReason(buildOpts, preset, semanticUsed),
        },
        sentiment: {
            requested: resolveSentimentRequested(cli.sentiment),
            used: sentimentUsed,
            model: sentimentModel,
            skippedReason: inferSentimentSkipReason(buildOpts, preset, sentimentUsed),
        },
        llm: {
            tier: llmTier,
            used: llmUsed,
            modelId: qwenModelIdForTier(llmTier),
            skippedReason: inferLlmSkipReason(preset, llmTier, llmUsed, profileMachine),
        },
        topicModel: resolveTopicModel(data),
        embeddingTopics: profileSettings.useEmbeddingTopics,
        budgetMs: analysisBudgetMs(preset, messageCount, profileMachine),
        envOverrides: collectEnvOverrides(),
        invokedVia: parseKcaInvokerEnv(process.env.KCA_INVOKER),
        messageCount,
        machine: {
            freeMemGb: profileMachine.freeMemGb,
            totalMemGb: profileMachine.totalMemGb,
            gpu: profileMachine.gpu,
        },
    };
}
export function withWorkerUsed(config, workerUsed) {
    return { ...config, workerUsed };
}
/** 집계 전 예상 preset (stderr 힌트) */
export function estimatePresetBeforeParse(cli, messageEstimate) {
    const machine = probeMachineProfileSync();
    if (cli.preset || cli.worker === true || process.env.KCA_PROFILE === "fast") {
        return {
            preset: resolvePresetName({ preset: cli.preset, worker: cli.worker }),
            source: resolvePresetSource(cli.preset, cli.worker, messageEstimate ?? 0, machine),
        };
    }
    const env = process.env.KCA_PRESET?.trim().toLowerCase();
    if (env === "speed" || env === "balanced" || env === "quality" || env === "custom") {
        return { preset: env, source: "env" };
    }
    const n = messageEstimate ?? 0;
    return {
        preset: autoPresetFromMachine(machine, n),
        source: resolvePresetSource(undefined, undefined, n, machine),
    };
}
export function formatEstimatedPresetHint(cli, messageEstimate) {
    const machine = probeMachineProfileSync();
    const { preset, source } = estimatePresetBeforeParse(cli, messageEstimate);
    const n = messageEstimate !== undefined
        ? ` · 메시지 ~${messageEstimate.toLocaleString("ko-KR")}건`
        : "";
    return `[kca] 예상 preset: ${preset} (${presetSourceLabel(source)} · RAM ${machine.freeMemGb}GB${n})`;
}
function formatRequested(req) {
    if (req === "auto")
        return "auto";
    return req ? "on" : "off";
}
export function formatConfigSummaryKo(config) {
    const lines = [
        "=== kca 분석 설정 ===",
        `preset: ${config.preset} (${presetSourceLabel(config.presetSource)})`,
        `프로필: ${config.profile} · 프라이버시: ${config.privacy} · 상위 목록: ${config.top}`,
        `메시지: ${config.messageCount.toLocaleString("ko-KR")}건 · RAM ${config.machine.freeMemGb}/${config.machine.totalMemGb}GB · GPU ${config.machine.gpu}`,
        `Worker: 요청 ${formatRequested(config.workerRequested)} · 실제 ${config.workerUsed ? "사용" : "미사용"}`,
    ];
    if (config.since)
        lines.push(`기간 필터: ${config.since} 이후`);
    const sem = config.semantic;
    lines.push(`시맨틱: 요청 ${formatRequested(sem.requested)} · 실제 ${sem.used ? "사용" : "미사용"} · 모델 ${sem.model}${sem.sampleCap ? ` · 상한 ${sem.sampleCap}` : ""}`);
    if (!sem.used && sem.skippedReason)
        lines.push(`  ↳ 미사용 사유: ${sem.skippedReason}`);
    const sent = config.sentiment;
    lines.push(`감정: 요청 ${formatRequested(sent.requested)} · 실제 ${sent.used ? "사용" : "미사용"} · 모델 ${sent.model}`);
    if (!sent.used && sent.skippedReason)
        lines.push(`  ↳ 미사용 사유: ${sent.skippedReason}`);
    const llm = config.llm;
    lines.push(`LLM: tier ${llm.tier} · 실제 ${llm.used ? "사용" : "미사용"}${llm.modelId ? ` · ${llm.modelId}` : ""}`);
    if (!llm.used && llm.skippedReason)
        lines.push(`  ↳ 미사용 사유: ${llm.skippedReason}`);
    lines.push(`주제: ${config.topicModel} · 임베딩 주제 레인: ${config.embeddingTopics ? "on" : "off"} · 분석 예산 ~${Math.round(config.budgetMs / 1000)}s`);
    if (config.invokedVia) {
        lines.push(`실행 경로: ${config.invokedVia.name} ${config.invokedVia.version} → kca`);
    }
    if (config.envOverrides.length > 0) {
        lines.push(`환경 변수: ${config.envOverrides.join(", ")}`);
    }
    return lines.join("\n");
}
export function configToJson(config) {
    return JSON.stringify(config, null, 2);
}
export function toProvenanceOptions(config, data, extras) {
    return {
        privacy: config.privacy,
        top: config.top,
        since: config.since,
        workerRequested: config.workerRequested,
        workerUsed: config.workerUsed,
        semanticRequested: config.semantic.requested,
        sentimentRequested: config.sentiment.requested,
        kiwiAvailable: extras.kiwiAvailable,
        preset: config.preset,
        presetSource: config.presetSource,
        semanticModel: config.semantic.model,
        semanticCap: config.semantic.sampleCap,
        semanticSkippedReason: !config.semantic.used && config.semantic.skippedReason
            ? config.semantic.skippedReason
            : undefined,
        sentimentModel: config.sentiment.model,
        sentimentSkippedReason: !config.sentiment.used && config.sentiment.skippedReason
            ? config.sentiment.skippedReason
            : undefined,
        llmTier: config.llm.tier,
        llmUsed: config.llm.used,
        llmSkippedReason: !config.llm.used && config.llm.skippedReason ? config.llm.skippedReason : undefined,
        llmModelId: config.llm.modelId,
        gpu: config.machine.gpu,
        budgetMs: config.budgetMs,
        envOverrides: config.envOverrides.length > 0 ? config.envOverrides : undefined,
        embeddingTopics: config.embeddingTopics,
        buildTiming: extras.buildTiming,
        htmlBytes: extras.htmlBytes,
    };
}
//# sourceMappingURL=analysis-effective-config.js.map