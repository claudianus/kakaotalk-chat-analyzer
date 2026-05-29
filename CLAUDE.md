# CLAUDE.md — Project Instructions for Claude Code

> Full details: [AGENTS.md](AGENTS.md)

## Packages

| Package | Description |
|---|---|
| `kakaotalk-chat-analyzer` | Main CLI (`kca`) |
| `kcachat` | Short `npx` name wrapper (depends on main) |

## PR / Deploy Workflow

- **Never push directly to `main`** for source, dist, package.json, or kcachat changes.
- PR → cubic review → 0 issues + CI pass → `gh pr merge`
- After merge: verify npm publish via GitHub Actions (`npm-publish.yml`), or publish locally (`npm test && npm publish --access public`, then `cd kcachat && npm install && npm publish --access public`).

## Version Rules

- New tarball requires a version bump commit.
- Main-only change: bump root `package.json` version.
- Wrapper-only change: bump `kcachat/package.json` version.
- Docs-only change (README, docs/, AGENTS.md): **no version bump needed**.

## Build

`npm run build` runs: `scripts/sync-version.mjs` → CSS bundle → `tsc`

## Report Visual QA (Mandatory)

After touching report HTML/charts/Wrapped/keywords/theme/layout, **must** run visual QA before merging to main. Passing `npm test` alone is not sufficient.

## Docs Sync Checklist (after deploy)

1. README.md — recent table + report UX (if behavior changed)
2. `docs/index.html` — pill/hero via `npm run sync-docs-version` then `npm run check:docs-version`
3. `kcachat/README.md` — only if wrapper env/behavior changed
4. Verify **Deploy GitHub Pages** Actions success after `docs/` changes
