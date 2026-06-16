#!/usr/bin/env node
import { auditReportHtml, collectHtmlFiles } from "./report-quality-audit-lib.mjs";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node scripts/report-quality-audit.mjs <report.html|dir> [...]");
  process.exit(2);
}

const htmlFiles = await collectHtmlFiles(targets);
if (htmlFiles.length === 0) {
  console.error("report-quality-audit: no HTML reports found");
  process.exit(2);
}

const results = [];
let failed = false;
for (const file of htmlFiles) {
  const result = await auditReportHtml(file);
  results.push(result);
  if (!result.ok) failed = true;
}

console.log(JSON.stringify({ ok: !failed, reports: results }, null, 2));
if (failed) process.exit(1);
