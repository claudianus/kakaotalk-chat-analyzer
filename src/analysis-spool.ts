import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatRecord } from "./types.js";

export async function createMessageSpoolPath(): Promise<string> {
  return join(tmpdir(), `kca-spool-${process.pid}-${randomUUID()}.ndjson`);
}

export async function removeSpool(spoolPath: string | null): Promise<void> {
  if (!spoolPath) return;
  await unlink(spoolPath).catch(() => undefined);
}

export interface SpoolKeywordPassOptions {
  since?: string;
  progressEvery?: number;
  onProgress?: (count: number) => void;
}

export async function* iterateSpoolRecords(spoolPath: string): AsyncGenerator<ChatRecord> {
  const rl = createInterface({
    input: createReadStream(spoolPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as ChatRecord;
  }
}
