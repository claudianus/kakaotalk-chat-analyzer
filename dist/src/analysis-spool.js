import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export async function createMessageSpoolPath() {
    return join(tmpdir(), `kca-spool-${process.pid}-${Date.now()}.ndjson`);
}
export async function removeSpool(spoolPath) {
    if (!spoolPath)
        return;
    await unlink(spoolPath).catch(() => undefined);
}
export async function* iterateSpoolRecords(spoolPath) {
    const rl = createInterface({
        input: createReadStream(spoolPath, { encoding: "utf8" }),
        crlfDelay: Infinity,
    });
    for await (const line of rl) {
        if (!line.trim())
            continue;
        yield JSON.parse(line);
    }
}
//# sourceMappingURL=analysis-spool.js.map