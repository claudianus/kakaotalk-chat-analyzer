import type {
  PrivacyMode,
  ReportBuildTiming,
  ReportData,
  ReportProvenance,
} from "./types.js";
import { VERSION } from "./version.js";

export const REPORT_SCHEMA = "2026-05";

export interface BuildReportProvenanceOptions {
  privacy: PrivacyMode;
  top: number;
  since?: string;
  workerRequested?: boolean | "auto";
  workerUsed: boolean;
  semanticRequested?: boolean | "auto";
  kiwiAvailable: boolean;
  buildTiming?: ReportBuildTiming;
  htmlBytes?: number;
}

export function parseKcaInvokerEnv(
  value: string | undefined,
): ReportProvenance["generator"]["invokedVia"] | undefined {
  if (!value?.trim()) return undefined;
  const m = /^kcachat\/(.+)$/.exec(value.trim());
  if (!m) return undefined;
  return { name: "kcachat", version: m[1]! };
}

export function buildReportProvenance(
  data: ReportData,
  options: BuildReportProvenanceOptions,
): ReportProvenance {
  const invokedVia = parseKcaInvokerEnv(process.env.KCA_INVOKER);
  const provenance: ReportProvenance = {
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
    const output: NonNullable<ReportProvenance["output"]> = {
      htmlBytes: options.htmlBytes ?? 0,
    };
    if (options.buildTiming) output.buildTiming = options.buildTiming;
    provenance.output = output;
  }

  return provenance;
}

/** HTML 1회 생성 후 provenance JSON·상세 목록만 갱신 */
export function patchReportProvenance(html: string, provenance: ReportProvenance): string {
  const script = `<script type="application/json" id="kca-provenance">${JSON.stringify(provenance)}</script>`;
  if (html.includes('id="kca-provenance"')) {
    return html.replace(
      /<script type="application\/json" id="kca-provenance">[\s\S]*?<\/script>/,
      script,
    );
  }
  return html.replace("</body>", `${script}\n</body>`);
}

export function formatGeneratorLine(provenance: ReportProvenance): string {
  const { generator } = provenance;
  let line = `kca ${generator.version}`;
  if (generator.invokedVia) {
    line = `${generator.invokedVia.name} ${generator.invokedVia.version} → ${line}`;
  }
  return line;
}

export function formatProvenanceDetails(provenance: ReportProvenance): string[] {
  const lines: string[] = [];
  lines.push(`생성 도구: ${formatGeneratorLine(provenance)}`);
  if (provenance.runtime) {
    lines.push(
      `런타임: Node ${provenance.runtime.node} · ${provenance.runtime.platform}/${provenance.runtime.arch}`,
    );
  }
  const a = provenance.analysis;
  lines.push(`프라이버시: ${a.privacy} · 상위 목록: ${a.top}`);
  if (a.since) lines.push(`기간 필터: ${a.since} 이후`);
  const workerReq =
    a.workerRequested === "auto" || a.workerRequested === undefined
      ? "auto"
      : a.workerRequested
        ? "on"
        : "off";
  lines.push(`Worker: 요청 ${workerReq} · 실제 ${a.workerUsed ? "사용" : "미사용"}`);
  const semReq =
    a.semanticRequested === "auto" || a.semanticRequested === undefined
      ? "auto"
      : a.semanticRequested
        ? "on"
        : "off";
  lines.push(`시맨틱 키워드: 요청 ${semReq} · 실제 ${a.semanticUsed ? "사용" : "미사용"}`);
  lines.push(`Kiwi 형태소: ${a.kiwiAvailable ? "사용 가능" : "미사용"}`);
  if (provenance.reportSchema) lines.push(`리포트 스키마: ${provenance.reportSchema}`);
  if (provenance.output?.htmlBytes !== undefined) {
    const kb = (provenance.output.htmlBytes / 1024).toFixed(1);
    lines.push(`HTML 크기: ${provenance.output.htmlBytes.toLocaleString("ko-KR")} bytes (${kb} KiB)`);
  }
  if (provenance.output?.buildTiming) {
    lines.push(`생성 소요: ${formatBuildTimingForProvenance(provenance.output.buildTiming)}`);
  }
  return lines;
}

function formatBuildTimingForProvenance(t: ReportBuildTiming): string {
  const total = formatDurationMs(t.totalMs);
  const agg = formatDurationMs(t.parseAggregateMs);
  const html = formatDurationMs(t.renderHtmlMs);
  const write = formatDurationMs(t.writeFileMs);
  return `${total} (집계 ${agg} · HTML ${html} · 저장 ${write})`;
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  return sec < 10 ? `${sec.toFixed(1)}초` : `${Math.round(sec)}초`;
}
