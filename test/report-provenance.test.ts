import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportProvenance,
  formatGeneratorLine,
  parseKcaInvokerEnv,
  patchReportProvenance,
  resolveTopicModel,
} from "../src/report-provenance.js";
import { emptyReportData } from "../src/report-empty.js";
import { VERSION } from "../src/version.js";

test("parseKcaInvokerEnv accepts kcachat/name", () => {
  assert.deepEqual(parseKcaInvokerEnv("kcachat/0.1.31"), {
    name: "kcachat",
    version: "0.1.31",
  });
  assert.equal(parseKcaInvokerEnv(""), undefined);
  assert.equal(parseKcaInvokerEnv("other/1"), undefined);
});

test("buildReportProvenance includes generator version and analysis flags", () => {
  const data = emptyReportData();
  const p = buildReportProvenance(data, {
    privacy: "public-masked",
    top: 40,
    workerUsed: false,
    kiwiAvailable: false,
    htmlBytes: 120_000,
  });
  assert.equal(p.generator.version, VERSION);
  assert.equal(p.generator.name, "kakaotalk-chat-analyzer");
  assert.equal(p.analysis.semanticUsed, false);
  assert.equal(p.output?.htmlBytes, 120_000);
  assert.equal(p.reportSchema, "2026-05");
});

test("formatGeneratorLine shows kcachat chain", () => {
  const line = formatGeneratorLine({
    generator: {
      name: "kakaotalk-chat-analyzer",
      version: "0.13.3",
      invokedVia: { name: "kcachat", version: "0.1.31" },
    },
    analysis: {
      privacy: "public-masked",
      top: 40,
      semanticUsed: false,
      kiwiAvailable: false,
    },
  });
  assert.match(line, /kcachat 0\.1\.31 → kca 0\.13\.3/);
});

test("resolveTopicModel defaults to graph", () => {
  const data = emptyReportData();
  assert.equal(resolveTopicModel(data), "graph");
});

test("patchReportProvenance updates timing lines in HTML", () => {
  const html = `<p><strong>생성 소요</strong><br>1ms (집계 1ms · HTML 0ms · 저장 0ms)</p>
<ul class="kca-provenance-list"><li>생성 소요: 1ms</li></ul>
<footer>room · file · 경고 0건 · 생성 1ms · 본 리포트</footer>
<script type="application/json" id="kca-provenance">{}</script>`;
  const data = emptyReportData();
  const provenance = buildReportProvenance(data, {
    privacy: "public-masked",
    top: 40,
    workerUsed: false,
    kiwiAvailable: false,
    buildTiming: { parseAggregateMs: 100, renderHtmlMs: 50, writeFileMs: 10, totalMs: 160 },
    htmlBytes: 1000,
  });
  const patched = patchReportProvenance(html, provenance);
  assert.match(patched, /집계 100ms/);
  assert.match(patched, /생성 160ms/);
});
