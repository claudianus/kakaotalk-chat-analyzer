import { VERSION } from "./version.js";
export const REPORT_SCHEMA = "2026-05";
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
            kiwiAvailable: options.kiwiAvailable,
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
    lines.push(`Kiwi 형태소: ${a.kiwiAvailable ? "사용 가능" : "미사용"}`);
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