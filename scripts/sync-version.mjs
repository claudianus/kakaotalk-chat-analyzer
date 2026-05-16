import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const target = join(root, "src", "version.ts");
const body = `export const VERSION = ${JSON.stringify(version)};\nexport const USER_AGENT = \`kakaotalk-chat-analyzer/\${VERSION}\`;\n`;
writeFileSync(target, body, "utf8");
console.log(`sync-version: src/version.ts → ${version}`);
