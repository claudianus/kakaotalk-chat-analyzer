#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import { buildReportData } from "./analysis.js";
import { clearOwnerToken, getConfigPath, getOwnerToken, saveOwnerToken } from "./config.js";
import { describeParseResult, parseKakaoExport } from "./parser.js";
import { createProvider, parseHostName } from "./providers/index.js";
import { renderReportHtml } from "./report.js";
import { VERSION } from "./version.js";
import type { HostName, PublishResult } from "./providers/types.js";
import type { PrivacyMode } from "./types.js";

const DEFAULT_NAMESPACE = "kakao-chat-report";
const DEFAULT_OUT = ".tmp/kca-report";
const DEFAULT_TOP = 30;

const program = new Command();

program
  .name("kca")
  .description("Analyze KakaoTalk CSV exports and publish anonymized reports.")
  .version(VERSION);

program
  .command("inspect")
  .argument("<csv>", "KakaoTalk CSV export")
  .description("Inspect export structure without printing raw chat content.")
  .action(async (csv: string) => {
    const result = await parseKakaoExport(resolve(csv));
    console.log(describeParseResult(result));
    if (result.warnings.length > 0) {
      console.log("\nWarning details:");
      for (const warning of result.warnings.slice(0, 10)) {
        console.log(`- line ${warning.line}: ${warning.code}`);
      }
      if (result.warnings.length > 10) {
        console.log(`- ... ${result.warnings.length - 10} more`);
      }
    }
  });

program
  .command("analyze")
  .argument("<csv>", "KakaoTalk CSV export")
  .requiredOption("-o, --out <dir>", "output directory for index.html")
  .option("--privacy <mode>", "privacy mode", "public-anonymous")
  .option("--top <count>", "number of top rows to keep", String(DEFAULT_TOP))
  .description("Generate a local anonymized single-file HTML report.")
  .action(async (csv: string, options: AnalyzeOptions) => {
    const htmlPath = await generateReport(csv, {
      outDir: options.out,
      privacy: parsePrivacy(options.privacy),
      top: parsePositiveInt(options.top, DEFAULT_TOP),
    });
    console.log(`Report: ${htmlPath}`);
    console.log(`Size: ${await formatFileSize(htmlPath)}`);
  });

program
  .command("publish")
  .argument("<csv>", "KakaoTalk CSV export")
  .option("--host <host>", "brewpage, tempfile, or cloudflare", "brewpage")
  .option("--ttl <days>", "temporary hosting TTL in days", "30")
  .option("--ns <namespace>", "hosting namespace", DEFAULT_NAMESPACE)
  .option("--privacy <mode>", "privacy mode", "public-anonymous")
  .option("--top <count>", "number of top rows to keep", String(DEFAULT_TOP))
  .option("--out <dir>", "local report output directory", DEFAULT_OUT)
  .option("--dry-run", "generate the report but do not upload")
  .description("Generate and publish an anonymized report. Defaults to BrewPage with no signup.")
  .action(async (csv: string, options: PublishOptions) => {
    const host = parseHostName(options.host);
    const ttlDays = parseTtl(options.ttl);
    const namespace = sanitizeNamespace(options.ns);
    const htmlPath = await generateReport(csv, {
      outDir: options.out,
      privacy: parsePrivacy(options.privacy),
      top: parsePositiveInt(options.top, DEFAULT_TOP),
    });

    console.log(`Report: ${htmlPath}`);
    console.log(`Size: ${await formatFileSize(htmlPath)}`);

    if (options.dryRun) {
      console.log("Dry run: upload skipped.");
      return;
    }

    try {
      const provider = createProvider(host);
      const owner = await getOwnerToken(host, namespace);
      const html = await readReportHtml(htmlPath);
      const result = await provider.publish({
        html,
        ttlDays,
        namespace,
        title: "KakaoTalk Chat Report",
        ownerToken: owner?.ownerToken,
      });

      if (result.ownerToken) {
        await saveOwnerToken({
          provider: result.provider,
          namespace,
          ownerToken: result.ownerToken,
          ownerLink: result.ownerLink,
          id: result.id,
          link: result.link,
          expiresAt: result.expiresAt,
        });
      }

      printPublishResult(result, namespace);
    } catch (error) {
      console.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`Local report is still available at: ${htmlPath}`);
      if (host === "brewpage") {
        console.error(`No automatic fallback was attempted. To explicitly try TempFile, run: kca publish "${csv}" --host tempfile --ttl ${ttlDays}`);
      }
      process.exitCode = 1;
    }
  });

const token = program.command("token").description("Manage locally saved owner tokens.");

token
  .command("clear")
  .option("--host <host>", "host token to clear", "brewpage")
  .option("--ns <namespace>", "namespace token to clear", DEFAULT_NAMESPACE)
  .description("Forget a locally saved owner token.")
  .action(async (options: TokenOptions) => {
    const host = parseHostName(options.host);
    const namespace = sanitizeNamespace(options.ns);
    const cleared = await clearOwnerToken(host, namespace);
    console.log(cleared ? `Cleared token for ${host}/${namespace}.` : `No token saved for ${host}/${namespace}.`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

interface AnalyzeOptions {
  out: string;
  privacy: string;
  top: string;
}

interface PublishOptions {
  host: string;
  ttl: string;
  ns: string;
  privacy: string;
  top: string;
  out: string;
  dryRun?: boolean;
}

interface TokenOptions {
  host: string;
  ns: string;
}

async function generateReport(csv: string, options: { outDir: string; privacy: PrivacyMode; top: number }): Promise<string> {
  const result = await parseKakaoExport(resolve(csv));
  const data = buildReportData(result, { privacy: options.privacy, top: options.top });
  const html = renderReportHtml(data);
  const outDir = resolve(options.outDir);
  const htmlPath = resolve(outDir, "index.html");

  await mkdir(outDir, { recursive: true });
  await writeFile(htmlPath, html, "utf8");
  return htmlPath;
}

async function readReportHtml(htmlPath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(htmlPath, "utf8");
}

function parsePrivacy(value: string): PrivacyMode {
  if (value === "public-anonymous") return value;
  throw new Error(`Unsupported privacy mode "${value}". Only public-anonymous is supported in v1.`);
}

function parseTtl(value: string): number {
  const ttl = parsePositiveInt(value, 30);
  return Math.max(1, Math.min(30, ttl));
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeNamespace(value: string): string {
  const normalized = value.toLowerCase().trim();
  if (!/^[a-z0-9-]{3,32}$/.test(normalized)) {
    throw new Error("Namespace must match [a-z0-9-]{3,32}.");
  }
  return normalized;
}

async function formatFileSize(filePath: string): Promise<string> {
  const size = (await stat(filePath)).size;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / 1024 / 1024).toFixed(2)} MiB`;
}

function printPublishResult(result: PublishResult, namespace: string): void {
  console.log(`URL: ${result.link}`);
  if (result.expiresAt) console.log(`Expires: ${result.expiresAt}`);
  if (result.ownerLink) console.log(`Owner link: ${result.ownerLink}`);
  if (result.ownerToken) console.log(`Owner token: ${maskToken(result.ownerToken)} (saved in ${getConfigPath()})`);
  console.log(`Host: ${result.provider}`);
  console.log(`Namespace: ${namespace}`);
}

function maskToken(token: string): string {
  if (token.length <= 10) return "********";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
