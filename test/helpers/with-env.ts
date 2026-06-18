export type EnvSnapshot = Record<string, string | undefined>;

export function snapshotEnv(keys: string[]): EnvSnapshot {
  const snap: EnvSnapshot = {};
  for (const key of keys) snap[key] = process.env[key];
  return snap;
}

export function restoreEnv(snap: EnvSnapshot): void {
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

export async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const keys = Object.keys(patch);
  const snap = snapshotEnv(keys);
  try {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    restoreEnv(snap);
  }
}
