import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  __setLlmSpawnForTest,
  decodeChildFailure,
  runLlmInChildProcess,
} from "../src/llm-subprocess.js";

test("decodeChildFailure maps SIGSEGV and exit 139", () => {
  assert.equal(decodeChildFailure(null, "SIGSEGV"), "segfault");
  assert.equal(decodeChildFailure(139, null), "segfault");
  assert.equal(decodeChildFailure(1, null), "error");
});

test("runLlmInChildProcess returns segfault on child exit 139", async () => {
  __setLlmSpawnForTest(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: { write: () => void; end: () => void };
      stdout: EventEmitter & { setEncoding: () => void };
      stderr: EventEmitter & { setEncoding: () => void };
      kill: () => void;
    };
    child.stdin = { write: () => {}, end: () => {} };
    child.stdout = Object.assign(new EventEmitter(), { setEncoding: () => {} });
    child.stderr = Object.assign(new EventEmitter(), { setEncoding: () => {} });
    child.kill = () => {};
    setImmediate(() => child.emit("close", 139, null));
    return child as never;
  });

  const res = await runLlmInChildProcess({
    modelPath: "/tmp/x.gguf",
    prompt: "hi",
    inferTimeoutMs: 1000,
    loadTimeoutMs: 1000,
    gpu: "metal",
  });

  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.kind, "segfault");

  __setLlmSpawnForTest(null);
});

test("runLlmInChildProcess parses child JSON success", async () => {
  __setLlmSpawnForTest(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: { write: () => void; end: () => void };
      stdout: EventEmitter & { setEncoding: () => void };
      stderr: EventEmitter & { setEncoding: () => void };
      kill: () => void;
    };
    child.stdin = { write: () => {}, end: () => {} };
    const stdout = Object.assign(new EventEmitter(), { setEncoding: () => {} });
    child.stdout = stdout;
    child.stderr = Object.assign(new EventEmitter(), { setEncoding: () => {} });
    child.kill = () => {};
    setImmediate(() => {
      stdout.emit("data", `${JSON.stringify({ ok: true, text: '{"paragraphs":[]}' })}\n`);
      child.emit("close", 0, null);
    });
    return child as never;
  });

  const res = await runLlmInChildProcess({
    modelPath: "/tmp/x.gguf",
    prompt: "hi",
    inferTimeoutMs: 1000,
    loadTimeoutMs: 1000,
    gpu: "none",
  });

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.text, '{"paragraphs":[]}');

  __setLlmSpawnForTest(null);
});
