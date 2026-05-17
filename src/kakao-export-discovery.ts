import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface KakaoExportFile {
  path: string;
  name: string;
  mtimeMs: number;
  size: number;
}

export interface ResolveKakaoExportOptions {
  /** 검색 폴더 (기본: KCA_CSV_DIR → ~/Downloads) */
  dir?: string;
  /** 0 = 최신, 1 = 두 번째로 최근 … */
  index?: number;
  /** 빈 파일 거부 (기본 1) */
  minBytes?: number;
}

export function expandHome(path: string): string {
  return path.startsWith("~") ? join(homedir(), path.slice(1)) : path;
}

export function defaultKakaoCsvDir(): string {
  const fromEnv = process.env.KCA_CSV_DIR ?? process.env.KCA_QA_CSV_DIR;
  return resolve(expandHome(fromEnv ?? join(homedir(), "Downloads")));
}

export async function listKakaoExports(dir: string): Promise<KakaoExportFile[]> {
  const resolved = resolve(expandHome(dir));
  let entries;
  try {
    entries = await readdir(resolved, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`CSV 폴더를 찾을 수 없습니다: ${resolved}`);
    }
    throw error;
  }

  const files: KakaoExportFile[] = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (!/\.csv$/i.test(name)) continue;
    if (!/^KakaoTalk/i.test(name)) continue;
    const path = join(resolved, name);
    const st = await stat(path);
    files.push({ path, name, mtimeMs: st.mtimeMs, size: st.size });
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export async function resolveKakaoExport(
  options: ResolveKakaoExportOptions = {},
): Promise<KakaoExportFile> {
  const dir = options.dir ?? defaultKakaoCsvDir();
  const index = options.index ?? 0;
  const minBytes = options.minBytes ?? 1;
  const all = await listKakaoExports(dir);

  if (all.length === 0) {
    throw new Error(
      `${dir}에 KakaoTalk*.csv가 없습니다. 카카오톡에서 대화보내기 후 CSV를 저장하거나 KCA_CSV_DIR로 폴더를 지정하세요.`,
    );
  }

  if (index < 0 || index >= all.length) {
    throw new Error(
      `--pick ${index}은(는) 범위를 벗어났습니다. ${dir}에 ${all.length}개의 KakaoTalk CSV가 있습니다 (0=최신).`,
    );
  }

  const picked = all[index]!;
  if (picked.size < minBytes) {
    throw new Error(`CSV가 비어 있습니다 (${picked.name}, ${picked.size} bytes).`);
  }

  return picked;
}

export function formatExportPickLine(file: KakaoExportFile, roomName: string): string {
  const when = new Date(file.mtimeMs).toLocaleString("ko-KR");
  const size =
    file.size < 1024
      ? `${file.size} B`
      : file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KiB`
        : `${(file.size / 1024 / 1024).toFixed(2)} MiB`;
  return `${roomName} · ${file.name} · ${size} · ${when}`;
}
