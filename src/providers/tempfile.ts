import { USER_AGENT } from "../version.js";
import type { FetchLike, HostName, PublishProvider, PublishRequest, PublishResult } from "./types.js";

const DEFAULT_ENDPOINT = "https://tempfile.org/api/upload/local";

export class TempFileProvider implements PublishProvider {
  readonly name: HostName = "tempfile";

  constructor(
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    private readonly endpoint = DEFAULT_ENDPOINT,
  ) {}

  async publish(request: PublishRequest): Promise<PublishResult> {
    const form = new FormData();
    form.append("files", new Blob([request.html], { type: "text/html;charset=utf-8" }), "kakao-chat-report.html");
    form.append("expiryHours", String(Math.max(1, Math.round(request.ttlDays * 24))));

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
      },
      body: form,
    });

    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw new Error(`TempFile upload failed: HTTP ${response.status} ${response.statusText}${text ? ` - ${text.slice(0, 300)}` : ""}`);
    }

    const link = parseTempFileLink(body);
    if (!link) {
      throw new Error(`TempFile upload response did not include a file URL: ${text.slice(0, 300)}`);
    }

    return {
      provider: this.name,
      link,
      expiresAt: expiryFromTtl(request.ttlDays),
    };
  }
}

function parseTempFileLink(body: unknown): string | undefined {
  const record = asRecord(body);
  const files = Array.isArray(record?.files) ? record.files : [];
  const firstFile = asRecord(files[0]);
  return stringField(firstFile, "url") ?? stringField(asRecord(record?.file), "url");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringField(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function expiryFromTtl(ttlDays: number): string {
  return new Date(Date.now() + Math.max(1, ttlDays) * 24 * 60 * 60 * 1000).toISOString();
}
