import { mkdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ggufPathForSize, hfDownloadUrl } from "./llm-cache.js";
import { MIN_GGUF_BYTES, parseQwen35Size, qwen35Entry, type Qwen35Size } from "./llm-qwen35.js";

export function parsePullSize(raw: string): Qwen35Size {
  const size = parseQwen35Size(raw);
  if (!size) {
    throw new Error(
      `지원 size: 0.8B | 2B | 4B | 9B (qwen3.5-4b 형식 가능). 받은 값: "${raw}"`,
    );
  }
  return size;
}

export async function pullLlmGguf(size: Qwen35Size): Promise<string> {
  const dest = ggufPathForSize(size);
  const minBytes = MIN_GGUF_BYTES[size];
  try {
    const st = await stat(dest);
    if (st.size >= minBytes) {
      process.stderr.write(`[kca] 이미 있음: ${dest} (${(st.size / 1024 / 1024).toFixed(1)} MiB)\n`);
      return dest;
    }
  } catch {
    /* download */
  }

  const { repo, file, hubId } = qwen35Entry(size).gguf;
  const url = hfDownloadUrl(repo, file);
  await mkdir(dirname(dest), { recursive: true });
  process.stderr.write(`[kca] Qwen3.5 GGUF 다운로드 (${hubId})\n${url}\n→ ${dest}\n`);

  const headers: Record<string, string> = {};
  const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`GGUF 다운로드 실패 (${res.status}): ${url}`);
  }

  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(dest));
  const st = await stat(dest);
  process.stderr.write(`[kca] 완료 ${(st.size / 1024 / 1024).toFixed(1)} MiB\n`);
  return dest;
}
