#!/usr/bin/env node
/**
 * .qa-reports 정적 서버 (브라우저 MCP는 file:// 불가 → http://localhost 사용)
 * Usage: npm run report:qa:serve
 */
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  process.env.KCA_QA_OUT ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".qa-reports"),
);
const port = Number(process.env.KCA_QA_PORT ?? "18765");

/** 기존 qa-serve가 떠 있으면 종료 (EADDRINUSE 방지) */
function freeListenPort(p) {
  try {
    const out = execSync(`lsof -t -i :${p}`, { encoding: "utf8" }).trim();
    if (!out) return;
    for (const pid of out.split("\n")) {
      const n = Number(pid);
      if (n > 0 && n !== process.pid) process.kill(n, "SIGTERM");
    }
  } catch {
    /* 포트 비어 있음 */
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/** macOS NFD 경로 ↔ 브라우저 NFC URL 불일치 방지 */
function normPath(s) {
  return s.normalize("NFC");
}

let slugDirs = new Map();

async function refreshSlugDirs() {
  const map = new Map();
  for (const name of await readdir(root, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    map.set(normPath(name.name), name.name);
  }
  slugDirs = map;
}

function resolveUnderRoot(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  const slugKey = normPath(parts[0]);
  const realSlug = slugDirs.get(slugKey);
  if (!realSlug) return null;
  const rest = parts.slice(1).join("/") || "index.html";
  const rel = join(realSlug, rest);
  const file = resolve(root, rel);
  if (!file.startsWith(root)) return null;
  return file;
}

const server = createServer(async (req, res) => {
  try {
    await refreshSlugDirs();
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/" || pathname === "") {
      const manifest = await readFile(join(root, "manifest.json"), "utf8").catch(() => null);
      const links = manifest
        ? JSON.parse(manifest).results.map(
            (r) => `<li><a href="/${encodeURIComponent(r.slug)}/">${r.slug}</a> (${r.messages} msgs)</li>`,
          )
        : [...slugDirs.keys()].map((s) => `<li><a href="/${encodeURIComponent(s)}/">${s}</a></li>`);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset=utf-8><h1>kca report QA</h1><ul>${links.join("")}</ul>`);
      return;
    }
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = resolveUnderRoot(pathname);
    if (!file) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const body = await readFile(file);
    const ext = file.slice(file.lastIndexOf("."));
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

freeListenPort(port);
server.listen(port, "127.0.0.1", () => {
  console.error(`[qa-serve] http://127.0.0.1:${port}/`);
  console.error(`[qa-serve] root: ${root}`);
});
