import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { clearOwnerToken, getOwnerToken, saveOwnerToken } from "../src/config.js";
import { BrewPageProvider } from "../src/providers/brewpage.js";
import type { FetchLike } from "../src/providers/types.js";
import { USER_AGENT } from "../src/version.js";

test("BrewPage provider posts HTML with namespace ttl and user agent", async () => {
  const calls: Array<{ url: string; init: { method: string; headers?: Record<string, string>; body?: unknown } }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return response(
      201,
      JSON.stringify({
        id: "abc123",
        link: "https://brewpage.app/kakao-chat-report/abc123",
        ownerToken: "dlt_secret_token",
        ownerLink: "https://brewpage.app/api/html/kakao-chat-report/abc123",
        expiresAt: "2026-06-15T00:00:00.000Z",
      }),
    );
  };

  const provider = new BrewPageProvider(fetchImpl, "https://brewpage.app/api/html");
  const result = await provider.publish({
    html: "<h1>Safe report</h1>",
    ttlDays: 30,
    namespace: "kakao-chat-report",
    title: "KakaoTalk Chat Report",
  });

  assert.equal(result.link, "https://brewpage.app/kakao-chat-report/abc123");
  assert.equal(result.ownerToken, "dlt_secret_token");
  assert.equal(calls.length, 1);

  const call = calls[0]!;
  const url = new URL(call.url);
  assert.equal(url.searchParams.get("ns"), "kakao-chat-report");
  assert.equal(url.searchParams.get("ttl"), "30");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers?.["User-Agent"], USER_AGENT);
  assert.equal(call.init.headers?.["Content-Type"], "application/json");
  assert.equal(JSON.parse(String(call.init.body)).content, "<h1>Safe report</h1>");
});

test("BrewPage provider reports HTTP failures", async () => {
  const provider = new BrewPageProvider(async () => response(429, "rate limited"), "https://brewpage.app/api/html");

  await assert.rejects(
    provider.publish({
      html: "<h1>Safe report</h1>",
      ttlDays: 30,
      namespace: "kakao-chat-report",
      title: "KakaoTalk Chat Report",
    }),
    /HTTP 429/,
  );
});

test("owner token can be saved loaded and cleared", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-config-"));
  const path = join(dir, "config.json");

  try {
    await saveOwnerToken(
      {
        provider: "brewpage",
        namespace: "kakao-chat-report",
        ownerToken: "dlt_secret_token",
        ownerLink: "https://brewpage.app/api/html/kakao-chat-report/abc123",
        id: "abc123",
        link: "https://brewpage.app/kakao-chat-report/abc123",
        expiresAt: "2026-06-15T00:00:00.000Z",
      },
      path,
    );

    const loaded = await getOwnerToken("brewpage", "kakao-chat-report", path);
    assert.equal(loaded?.ownerToken, "dlt_secret_token");

    assert.equal(await clearOwnerToken("brewpage", "kakao-chat-report", path), true);
    assert.equal(await getOwnerToken("brewpage", "kakao-chat-report", path), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function response(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 201 ? "Created" : "Error",
    async json() {
      return JSON.parse(body);
    },
    async text() {
      return body;
    },
  };
}
