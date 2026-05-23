import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const target = join(root, "src", "version.ts");
const body = `export const VERSION = ${JSON.stringify(version)};\nexport const USER_AGENT = \`kakaotalk-chat-analyzer/\${VERSION}\`;\n`;
writeFileSync(target, body, "utf8");
console.log(`sync-version: src/version.ts → ${version}`);

// Sync kcachat dependency range to match main version
const kcachatPkgPath = join(root, "kcachat", "package.json");
const kcachatPkg = JSON.parse(readFileSync(kcachatPkgPath, "utf-8"));
const minor = version.split(".").slice(0, 2).join(".");
kcachatPkg.dependencies["kakaotalk-chat-analyzer"] = `^${minor}.0`;
writeFileSync(kcachatPkgPath, JSON.stringify(kcachatPkg, null, 2) + "\n");
console.log(`sync-version: kcachat/package.json dependency → ^${minor}.0`);
