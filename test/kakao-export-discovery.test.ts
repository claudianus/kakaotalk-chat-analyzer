import assert from "node:assert/strict";
import { mkdtemp, writeFile, utimes } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  listKakaoExports,
  platformKakaoCsvDirCandidates,
  resolveKakaoExport,
} from "../src/kakao-export-discovery.js";

test("platformKakaoCsvDirCandidates prefers Windows KakaoTalk Documents folder", () => {
  const home = homedir();
  const win = platformKakaoCsvDirCandidates(home);
  if (process.platform === "win32") {
    assert.equal(win[0], join(home, "Documents", "카카오톡 받은 파일"));
    assert.equal(win[1], join(home, "Documents", "카카오톡"));
    assert.equal(win[2], join(home, "Downloads"));
  } else {
    assert.deepEqual(win, [join(home, "Downloads")]);
  }
});

test("listKakaoExports sorts by mtime descending", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-disc-"));
  const older = join(dir, "KakaoTalk_Chat_older.csv");
  const newer = join(dir, "KakaoTalk_Chat_newer.csv");
  await writeFile(older, "Date,User,Message\n2024-01-01 10:00:00,A,hi\n", "utf8");
  await writeFile(newer, "Date,User,Message\n2024-01-02 10:00:00,B,hi\n", "utf8");
  const base = Date.now();
  await utimes(older, base / 1000 - 100, base / 1000 - 100);
  await utimes(newer, base / 1000, base / 1000);

  const files = await listKakaoExports(dir);
  assert.equal(files.length, 2);
  assert.equal(files[0]!.name, "KakaoTalk_Chat_newer.csv");
  assert.equal(files[1]!.name, "KakaoTalk_Chat_older.csv");
});

test("resolveKakaoExport respects pick index", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-disc-"));
  const a = join(dir, "KakaoTalk_A.csv");
  const b = join(dir, "KakaoTalk_B.csv");
  await writeFile(a, "Date,User,Message\n2024-01-01 10:00:00,A,hi\n", "utf8");
  await writeFile(b, "Date,User,Message\n2024-01-02 10:00:00,B,hi\n", "utf8");
  const now = Date.now() / 1000;
  await utimes(a, now - 50, now - 50);
  await utimes(b, now, now);

  const second = await resolveKakaoExport({ dir, index: 1 });
  assert.equal(second.name, "KakaoTalk_A.csv");
});

test("resolveKakaoExport errors on empty directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-disc-empty-"));
  await assert.rejects(() => resolveKakaoExport({ dir }), /KakaoTalk\*\.csv/);
});

test("listKakaoExports ignores non-KakaoTalk csv", async () => {
  const dir = await mkdtemp(join(tmpdir(), "kca-disc-other-"));
  await writeFile(join(dir, "other.csv"), "x", "utf8");
  await writeFile(
    join(dir, "KakaoTalk_Chat_room.csv"),
    "Date,User,Message\n2024-01-01 10:00:00,A,hi\n",
    "utf8",
  );
  const files = await listKakaoExports(dir);
  assert.equal(files.length, 1);
  assert.equal(files[0]!.name, "KakaoTalk_Chat_room.csv");
});
