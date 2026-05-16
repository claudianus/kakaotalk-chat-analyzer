import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { loadGlossaryForExport } from "../src/glossary.js";

describe("glossary", () => {
  it("loads .kca-glossary.txt next to export", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kca-gloss-"));
    const csv = join(dir, "chat.csv");
    await writeFile(join(dir, ".kca-glossary.txt"), "클로드\ncodex\n# comment\n", "utf8");
    const words = await loadGlossaryForExport(csv);
    assert.ok(words.some((w) => w.word === "클로드"));
    assert.ok(words.some((w) => w.word === "codex" || w.word === "코덱스"));
  });
});
