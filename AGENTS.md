# AGENTS.md — Project Instructions

> Claude Code 전용 간결 버전: [CLAUDE.md](CLAUDE.md)

## 패키지

| 패키지 | 설명 |
|--------|------|
| `kakaotalk-chat-analyzer` | 본체 CLI (`kca`) |
| `kcachat` | 짧은 `npx` 이름 래퍼(본체 의존) |

## 0. 최초 세팅: `NPM_TOKEN`을 GitHub에 넣기

   - `bash scripts/sync-npm-token-to-gh.sh`

## 1. PR·Cubic·머지·배포

PR → cubic 리뷰 → 이슈 0 + CI pass → `gh pr merge`만 허용.
- **cubic 사용 불가 시(구독 만료·장애·체크 `skipping`)**: cubic 게이트는 건너뛰고 **CI green + 셀프 리뷰**로 대체. cubic 미동작이 배포를 막아선 안 됨.
- 사소한 docs·주석만 변경은 cubic 생략 가능(`pr-test.yml`가 `docs/**`·`*.md`는 이미 제외).

**금지 사항:**
- `main`에 직접 푸시 금지
- 리뷰 이슈 미해결 상태에서 병합 금지

머지 후 npm publish 확인: GitHub Actions(`npm-publish.yml`) 또는 로컬(`npm test && npm publish --access public`, `cd kcachat && npm install && npm publish --access public`).

**publish 실패 디버깅 (npm 토큰은 만료됨):**
- `npm error 404 ... PUT .../kakaotalk-chat-analyzer`는 **권한이 아니라 인증 실패**(빈·만료 토큰)을 가린다. → `gh secret list`로 `NPM_TOKEN` 확인 → 없거나 오래됐으면 `bash scripts/sync-npm-token-to-gh.sh` 재실행 후 `gh run rerun <id> --failed`.
- CI(`--provenance`)가 계속 404면 로컬 `npm publish --access public`로 배포(허용된 폴백). 토큰은 npm **Automation/Granular(publish)** 종류여야 CI에서 동작.

## 2. 버전 번호 규율

- 새 tarball에는 버전 업 커밋 필수.
- 본체만 변경: 루트 `package.json` 버전 업.
- 래퍼만 변경: `kcachat/package.json` 버전 업.
- 문서만 변경(README, docs/, AGENTS.md): **버전 업 불필요**.
- 빌드/개발 스크립트(`scripts/`)·CI·훅만 변경(런타임 동작 불변): **버전 업 불필요**. publish는 버전 동일 시 자동 skip.

## 3. 빌드

`npm run build` → `scripts/sync-version.mjs` → CSS bundle → `tsc`

## 4. 리포트 비주얼 QA (필수)

리포트 HTML/charts/Wrapped/keywords/theme/layout 변경 시 머지 전 브라우저 QA 필수. `npm test`만으로는 부족.

1. 리포트를 브라우저에서 열어 전체 스크롤 확인
2. 다크/라이트 테마 모두 확인
3. 모바일 뷰포트 확인

## 5. Docs 버전 동기화 (버전 범프 시 **머지 전**)

CI `docs-version-check`(`pr-test.yml`)가 PR에서 `package.json` 버전 ↔ docs 3종 일치를 강제한다. "배포 후"가 아니라 **머지 전**에 맞춰야 CI가 통과된다.

1. **`npm run sync-docs-all`** — `docs/index.html` 배지 + `docs/assets/demo/manifest.json` 버전 자동 동기화. 데모 이미지 변경 없는 백엔드 릴리스엔 `docs:capture-demo` 불필요.
2. [README.md](README.md) — `최근` 표 맨 위에 새 버전 행 추가(변경 요약). CI가 top row 버전도 검사하므로 사람이 한 줄 작성.
3. `npm run check:docs-version` — 3종(index.html/manifest/README) 통과 확인.
4. [kcachat/README.md](kcachat/README.md) — 래퍼 env·동작 변경 시만.
5. `docs/` 변경 후 **Deploy GitHub Pages** Actions 성공 확인.
