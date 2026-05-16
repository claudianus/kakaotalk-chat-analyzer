import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UserWord } from "kiwi-nlp";
import { canonicalKeywordToken } from "./keyword-canonical.js";

const HAS_TOKEN = /[가-힣A-Za-z]/;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function lineToUserWord(line: string): UserWord | null {
  const raw = line.replace(/#.*$/, "").trim();
  if (!raw || !HAS_TOKEN.test(raw)) return null;
  const word = /^[A-Za-z0-9_+-]+$/.test(raw)
    ? canonicalKeywordToken(raw.toLowerCase())
    : canonicalKeywordToken(raw);
  if (word.length < 2 || word.length > 16) return null;
  return {
    word,
    tag: /^[A-Za-z]/.test(word) ? "SL" : "NNP",
    score: 6,
  };
}

/** CSV 옆 `.kca-glossary.txt` 또는 `{채팅방}.kca-glossary.txt` */
export async function loadGlossaryForExport(exportPath: string): Promise<UserWord[]> {
  const dir = dirname(exportPath);
  const base = exportPath.replace(/\.[^.]+$/, "");
  const candidates = [join(dir, ".kca-glossary.txt"), `${base}.kca-glossary.txt`];

  const out: UserWord[] = [];
  const seen = new Set<string>();

  for (const path of candidates) {
    if (!(await fileExists(path))) continue;
    const text = await readFile(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const uw = lineToUserWord(line);
      if (!uw || seen.has(uw.word)) continue;
      seen.add(uw.word);
      out.push(uw);
    }
  }

  return out.slice(0, 96);
}
