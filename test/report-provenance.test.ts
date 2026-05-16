import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportProvenance,
  formatGeneratorLine,
  parseKcaInvokerEnv,
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
