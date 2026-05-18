import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));

function runCli(args: string[], env: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

test("latest --list prints indexed KakaoTalk exports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-cli-list-"));
  const csv = join(dir, "KakaoTalk_Chat_room.csv");
  await writeFile(csv, "Date,User,Message\n2024-01-01 10:00:00,A,hi\n", "utf8");
  const now = Date.now() / 1000;
  await utimes(csv, now, now);

  const { code, stdout } = await runCli(["latest", "--list"], { KCA_CSV_DIR: dir });
  assert.equal(code, 0);
  assert.match(stdout, /\[0\]/);
  assert.match(stdout, /KakaoTalk_Chat_room\.csv/);
  assert.ok(stdout.includes(dir));
});

test("default with no csv picks latest from KCA_CSV_DIR", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-cli-pick-"));
  const csv = join(dir, "KakaoTalk_Chat_auto.csv");
  await writeFile(csv, "Date,User,Message\n2024-01-01 10:00:00,A,hi\n", "utf8");
  const now = Date.now() / 1000;
  await utimes(csv, now, now);

  const { code, stderr } = await runCli(["--local", "--dry-run", "--no-progress", "--no-semantic-keywords"], {
    KCA_CSV_DIR: dir,
    KCA_LLM: "0",
  });
  assert.equal(code, 0);
  assert.match(stderr, /KakaoTalk_Chat_auto\.csv/);
});
