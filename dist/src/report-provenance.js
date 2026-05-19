import { escapeHtml } from "./report-util.js";
import { profanityLexiconVersion } from "./profanity.js";
import { VERSION } from "./version.js";
export const REPORT_SCHEMA = "2026-05";
const PRESET_SOURCE_LABELS = {
    cli: "CLI --preset",
    env: "환경 변수 KCA_PRESET",
    "auto-ram": "RAM 기준 자동",
    "auto-corpus": "RAM·메시지 수 기준 자동",
    "legacy-fast": "CLI --fast / KCA_PROFILE=fast",
};
export function resolveTopicModel(data) {
    const embedEnv = process.env.KCA_EMBEDDING_TOPICS === "1";
    const hasEmbedTheme = data.topics.some((t) => t.kind === "theme" && (t.id.startsWith("embed-") || t.title.includes("임베딩")));
    if (embedEnv && hasEmbedTheme && data.summary.usedSemanticKeywords)
        return "hybrid";
    if (embedEnv && hasEmbedTheme)
        return "embedding";
    return "graph";
}
export function parseKcaInvokerEnv(value) {
    if (!value?.trim())
        return undefined;
    const m = /^kcachat\/(.+)$/.exec(value.trim());
    if (!m)
        return undefined;
    return { name: "kcachat", version: m[1] };
}
export function buildReportProvenance(data, options) {
    const invokedVia = parseKcaInvokerEnv(process.env.KCA_INVOKER);
    const provenance = {
        generator: {
            name: "kakaotalk-chat-analyzer",
            version: VERSION,
            ...(invokedVia ? { invokedVia } : {}),
        },
        runtime: {
            node: process.version,
            platform: process.platform,
            arch: process.arch,
        },
        analysis: {
            privacy: options.privacy,
            top: options.top,
            ...(options.since ? { since: options.since } : {}),
            ...(options.workerRequested !== undefined
                ? { workerRequested: options.workerRequested }
                : {}),
            workerUsed: options.workerUsed,
            ...(options.semanticRequested !== undefined
                ? { semanticRequested: options.semanticRequested }
                : {}),
            semanticUsed: data.summary.usedSemanticKeywords === true,
            ...(options.sentimentRequested !== undefined
                ? { sentimentRequested: options.sentimentRequested }
                : {}),
            sentimentUsed: data.summary.usedSentimentAnalysis === true,
            profanityLexiconVersion: profanityLexiconVersion(),
            kiwiAvailable: options.kiwiAvailable,
            topicModel: resolveTopicModel(data),
            ...(options.preset ? { preset: options.preset } : {}),
            ...(options.presetSource ? { presetSource: options.presetSource } : {}),
            ...(options.semanticModel ? { semanticModel: options.semanticModel } : {}),
            ...(options.semanticCap !== undefined ? { semanticCap: options.semanticCap } : {}),
            ...(options.semanticSkippedReason ? { semanticSkippedReason: options.semanticSkippedReason } : {}),
            ...(options.sentimentModel ? { sentimentModel: options.sentimentModel } : {}),
            ...(options.sentimentSkippedReason ? { sentimentSkippedReason: options.sentimentSkippedReason } : {}),
            ...(options.llmTier !== undefined ? { llmTier: options.llmTier } : {}),
            ...(options.llmUsed !== undefined ? { llmUsed: options.llmUsed } : {}),
            ...(options.llmSkippedReason ? { llmSkippedReason: options.llmSkippedReason } : {}),
            ...(options.llmModelId ? { llmModelId: options.llmModelId } : {}),
            ...(options.embeddingTopics !== undefined ? { embeddingTopics: options.embeddingTopics } : {}),
            ...(options.budgetMs !== undefined ? { budgetMs: options.budgetMs } : {}),
            ...(options.envOverrides?.length ? { envOverrides: options.envOverrides } : {}),
            ...(options.gpu ? { gpu: options.gpu } : {}),
            ...(options.llmMemoryTimeline?.length
                ? { llmMemoryTimeline: options.llmMemoryTimeline }
                : {}),
        },
        reportSchema: REPORT_SCHEMA,
    };
    if (options.htmlBytes !== undefined || options.buildTiming) {
        const output = {
            htmlBytes: options.htmlBytes ?? 0,
        };
        if (options.buildTiming)
            output.buildTiming = options.buildTiming;
        provenance.output = output;
    }
    return provenance;
}
/** HTML 1회 생성 후 provenance JSON·상세·생성 소요·푸터 타이밍 갱신 */
export function patchReportProvenance(html, provenance) {
    const script = `<script type="application/json" id="kca-provenance">${JSON.stringify(provenance)}</script>`;
    let out = html.includes('id="kca-provenance"')
        ? html.replace(/<script type="application\/json" id="kca-provenance">[\s\S]*?<\/script>/, script)
        : html.replace("</body>", `${script}\n</body>`);
    const lines = formatProvenanceDetails(provenance);
    out = out.replace(/<ul class="kca-provenance-list">[\s\S]*?<\/ul>/, `<ul class="kca-provenance-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`);
    if (provenance.output?.buildTiming) {
        const timingText = escapeHtml(formatBuildTimingForProvenance(provenance.output.buildTiming));
        out = out.replace(/<p><strong>생성 소요<\/strong><br>[^<]*<\/p>/, `<p><strong>생성 소요</strong><br>${timingText}</p>`);
        const short = escapeHtml(formatDurationMs(provenance.output.buildTiming.totalMs));
        out = out.replace(/ · 생성 [^·]+ · 본 리포트/, ` · 생성 ${short} · 본 리포트`);
    }
    return out;
}
export function formatGeneratorLine(provenance) {
    const { generator } = provenance;
    let line = `kca ${generator.version}`;
    if (generator.invokedVia) {
        line = `${generator.invokedVia.name} ${generator.invokedVia.version} → ${line}`;
    }
    return line;
}
export function formatProvenanceDetails(provenance) {
    const lines = [];
    lines.push(`생성 도구: ${formatGeneratorLine(provenance)}`);
    if (provenance.runtime) {
        lines.push(`런타임: Node ${provenance.runtime.node} · ${provenance.runtime.platform}/${provenance.runtime.arch}`);
    }
    const a = provenance.analysis;
    lines.push(`프라이버시: ${a.privacy} · 상위 목록: ${a.top}`);
    if (a.since)
        lines.push(`기간 필터: ${a.since} 이후`);
    const workerReq = a.workerRequested === "auto" || a.workerRequested === undefined
        ? "auto"
        : a.workerRequested
            ? "on"
            : "off";
    lines.push(`Worker: 요청 ${workerReq} · 실제 ${a.workerUsed ? "사용" : "미사용"}`);
    const semReq = a.semanticRequested === "auto" || a.semanticRequested === undefined
        ? "auto"
        : a.semanticRequested
            ? "on"
            : "off";
    lines.push(`시맨틱 키워드: 요청 ${semReq} · 실제 ${a.semanticUsed ? "사용" : "미사용"}`);
    const sentReq = a.sentimentRequested === "auto" || a.sentimentRequested === undefined
        ? "auto"
        : a.sentimentRequested
            ? "on"
            : "off";
    lines.push(`감정 분석: 요청 ${sentReq} · 실제 ${a.sentimentUsed ? "사용" : "미사용"}`);
    if (a.profanityLexiconVersion) {
        lines.push(`비속어 사전: ${a.profanityLexiconVersion}`);
    }
    lines.push(`Kiwi 형태소: ${a.kiwiAvailable ? "사용 가능" : "미사용"}`);
    if (a.topicModel) {
        const labels = {
            graph: "그래프(c-TF-IDF)",
            embedding: "임베딩 클러스터",
            hybrid: "그래프+임베딩",
        };
        lines.push(`주제 모델: ${labels[a.topicModel] ?? a.topicModel}`);
    }
    if (a.preset) {
        const src = a.presetSource ? PRESET_SOURCE_LABELS[a.presetSource] ?? a.presetSource : "";
        lines.push(`분석 preset: ${a.preset}${src ? ` (${src})` : ""}`);
    }
    if (a.semanticModel) {
        const cap = a.semanticCap !== undefined ? ` · 샘플 상한 ${a.semanticCap}` : "";
        lines.push(`시맨틱 모델: ${a.semanticModel}${cap}`);
    }
    if (!a.semanticUsed && a.semanticSkippedReason) {
        lines.push(`시맨틱 미사용 사유: ${a.semanticSkippedReason}`);
    }
    if (a.sentimentModel)
        lines.push(`감정 모델: ${a.sentimentModel}`);
    if (!a.sentimentUsed && a.sentimentSkippedReason) {
        lines.push(`감정 미사용 사유: ${a.sentimentSkippedReason}`);
    }
    if (a.llmTier !== undefined)
        lines.push(`LLM 티어: ${a.llmTier}`);
    if (a.llmUsed !== undefined) {
        const model = a.llmModelId ? ` (${a.llmModelId})` : "";
        lines.push(`LLM 보강: ${a.llmUsed ? "사용" : "미사용"}${model}`);
    }
    if (!a.llmUsed && a.llmSkippedReason)
        lines.push(`LLM 미사용 사유: ${a.llmSkippedReason}`);
    if (a.embeddingTopics !== undefined) {
        lines.push(`임베딩 주제 레인: ${a.embeddingTopics ? "on" : "off"}`);
    }
    if (a.budgetMs !== undefined) {
        lines.push(`분석 예산(휴리스틱): ~${Math.round(a.budgetMs / 1000)}초`);
    }
    if (a.envOverrides?.length)
        lines.push(`환경 변수: ${a.envOverrides.join(", ")}`);
    if (a.gpu)
        lines.push(`GPU (ONNX): ${a.gpu}`);
    if (provenance.reportSchema)
        lines.push(`리포트 스키마: ${provenance.reportSchema}`);
    if (provenance.output?.htmlBytes !== undefined) {
        const kb = (provenance.output.htmlBytes / 1024).toFixed(1);
        lines.push(`HTML 크기: ${provenance.output.htmlBytes.toLocaleString("ko-KR")} bytes (${kb} KiB)`);
    }
    if (provenance.output?.buildTiming) {
        lines.push(`생성 소요: ${formatBuildTimingForProvenance(provenance.output.buildTiming)}`);
    }
    return lines;
}
function formatBuildTimingForProvenance(t) {
    const total = formatDurationMs(t.totalMs);
    const agg = formatDurationMs(t.parseAggregateMs);
    const html = formatDurationMs(t.renderHtmlMs);
    const write = formatDurationMs(t.writeFileMs);
    return `${total} (집계 ${agg} · HTML ${html} · 저장 ${write})`;
}
function formatDurationMs(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    const sec = ms / 1000;
    return sec < 10 ? `${sec.toFixed(1)}초` : `${Math.round(sec)}초`;
}
//# sourceMappingURL=report-provenance.js.map