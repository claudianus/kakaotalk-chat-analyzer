#!/usr/bin/env node
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { auditReportHtml } from "./report-quality-audit-lib.mjs";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const outRoot = resolve(process.env.KCA_QA_OUT ?? join(repoRoot, ".tmp", "report-quality-matrix"));
const csvDir = resolve(process.env.KCA_CSV_DIR ?? join(process.env.HOME ?? ".", "Downloads"));
const nodeBin = process.execPath;
const cliPath = join(repoRoot, "dist", "src", "cli.js");

const cases = [
  { id: "auto", args: [] },
  { id: "speed", args: ["--preset", "speed"], env: { KCA_LLM: "0" } },
  { id: "balanced_no_llm", args: ["--preset", "balanced"], env: { KCA_LLM: "0" } },
  { id: "quality_no_llm", args: ["--preset", "quality"], env: { KCA_LLM: "0" } },
  { id: "ultra_no_llm", args: ["--preset", "ultra"], env: { KCA_LLM: "0" } },
  { id: "quality_mock_llm", args: ["--preset", "quality"], env: { KCA_LLM: "1", KCA_LLM_MOCK: "1" } },
  {
    id: "custom_semantic_sentiment_no_llm",
    args: ["--preset", "custom", "--semantic-keywords", "--sentiment"],
    env: { KCA_LLM: "0" },
  },
  { id: "quality_actual_llm", args: ["--preset", "quality"], env: { KCA_LLM: "1", KCA_LLM_MOCK: "" } },
];

function run(command, args, options) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else {
        const error = new Error(`command failed (${code}): ${command} ${args.join(" ")}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function newestHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await newestHtml(path).then((f) => f ? [f] : []));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      const info = await stat(path);
      files.push({ path, mtimeMs: info.mtimeMs });
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0] ?? null;
}

await mkdir(outRoot, { recursive: true });

const results = [];
for (const testCase of cases) {
  const outDir = join(outRoot, testCase.id);
  await mkdir(outDir, { recursive: true });
  const env = {
    ...process.env,
    ...(testCase.env ?? {}),
    KCA_NO_KIWI: process.env.KCA_NO_KIWI ?? "1",
    KCA_NO_KIWI_WORKERS: process.env.KCA_NO_KIWI_WORKERS ?? "1",
  };
  if (testCase.env && Object.hasOwn(testCase.env, "KCA_LLM_MOCK") && testCase.env.KCA_LLM_MOCK === "") {
    delete env.KCA_LLM_MOCK;
  }
  const args = [
    cliPath,
    "latest",
    "--local",
    "--no-progress",
    "--json-config",
    "--no-worker",
    "--dir",
    csvDir,
    "--pick",
    process.env.KCA_QA_PICK ?? "0",
    "--out",
    outDir,
    ...testCase.args,
  ];
  const started = Date.now();
  const runResult = await run(nodeBin, args, { env });
  const html = await newestHtml(outDir);
  if (!html) throw new Error(`no HTML generated for ${testCase.id}`);
  const audit = await auditReportHtml(html.path);
  results.push({
    id: testCase.id,
    ok: audit.ok,
    elapsedMs: Date.now() - started,
    report: html.path,
    audit,
    stdoutTail: runResult.stdout.slice(-1200),
    stderrTail: runResult.stderr.slice(-1200),
  });
}

const summary = {
  ok: results.every((r) => r.ok),
  csvDir,
  outRoot,
  cases: results,
};
await writeFile(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
