#!/usr/bin/env node
/**
 * Open GitHub Pages (or local docs preview) in the system default browser.
 *
 * Usage:
 *   npm run docs:open          # published Pages
 *   npm run docs:open -- local # http://127.0.0.1:8787 (run docs:preview:serve first)
 */
import { spawn } from "node:child_process";
import { platform } from "node:os";

const local = process.argv.includes("local");
const url = local
  ? "http://127.0.0.1:8787/#demo"
  : "https://claudianus.github.io/kakaotalk-chat-analyzer/#demo";

const cmd = platform() === "win32" ? "cmd" : "open";
const args = platform() === "win32" ? ["/c", "start", "", url] : [url];

const child = spawn(cmd, args, { stdio: "inherit", shell: platform() === "win32" });
child.on("error", (e) => {
  console.error("Could not open browser:", e.message);
  console.error("Open manually:", url);
  process.exit(1);
});
child.on("close", (code) => process.exit(code ?? 0));
