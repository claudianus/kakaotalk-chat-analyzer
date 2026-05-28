# 에이전트 지침 (필수)

이 저장소는 **npm에 두 패키지**를 올립니다.

| 패키지 | 설명 |
|--------|------|
| `kakaotalk-chat-analyzer` | 본체 CLI (`kca`) |
| `kcachat` | 짧은 `npx` 이름 래퍼(본체 의존) |

## 0. 최초 세팅: `NPM_TOKEN`을 GitHub에 넣기

1. npmjs.com → **Access Tokens** 에서 **Automation**(또는 Granular: **Publish packages**, 새 패키지까지 올릴 거면 정책상 **bypass 2FA** 허용이 필요할 수 있음) 토큰을 만든다.
2. 로컬에서 `gh` 로 GitHub에 로그인된 상태로 아래 중 하나를 실행한다.
   - `bash scripts/sync-npm-token-to-gh.sh`  
     (`~/.npmrc`의 `//registry.npmjs.org/:_authToken=` 를 읽어 `NPM_TOKEN` 시크릿으로 등록. **읽기 전용/legacy 토큰이면 퍼블리시는 실패**할 수 있음.)
   - 또는 `export NPM_TOKEN=npm_...` 후 같은 스크립트 실행.
   - 또는 한 줄 토큰만 담은 `.secrets/npm-token` 파일을 만들고 `NPM_TOKEN_FILE=.secrets/npm-token bash scripts/sync-npm-token-to-gh.sh` (`.secrets/`는 gitignore).
3. 시크릿을 바꾼 뒤에는 Actions에서 **Publish npm packages** 워크플로를 **workflow_dispatch**로 한 번 돌려 확인한다.

## 1. PR·Cubic·머지·배포

배포 가치 있는 변경(소스·`dist/`·`package.json`·`kcachat/` 등)은 **`main`에 직접 푸시하지 않는다.**  
PR → cubic 리뷰 → 이슈 0 + CI pass → `gh pr merge`만 허용.

**금지 사항:**
- `main`에 직접 푸시 금지
- 리뷰 이슈 미해결 상태에서 병합 금지
- CI 실패 상태에서 병합 금지

**머지 후 npm (필수):** “머지만 하고 끝” 금지.

- **Actions:** `NPM_TOKEN` 시크릿(§0) → `npm-publish.yml`이 `package.json` 버전이 레지스트리보다 새일 때만 publish → 에이전트가 Actions 성공 확인.
- **로컬:** `npm whoami` → 루트 `npm test` 후 `npm publish --access public` → `cd kcachat && npm install && npm publish --access public` (본체 먼저). 이미 올린 버전이면 Actions는 스킵.
- 버전 규율: §2.

## 2. 버전 번호 규율

- 레지스트리에 새 tarball을 올리려면 **반드시** 해당 패키지의 `version`을 올린 커밋이 있어야 한다.
- **본체만** 수정: 루트 `package.json`의 `version` 패치/마이너 올림.
- **`kcachat`만** 수정: `kcachat/package.json`의 `version` 올림(README만 고친 경우는 생략 가능).
- **본체 동작이 바뀌면** 래퍼 사용자에게 새 본체가 깔리도록, 필요 시 `kcachat/package.json`의 `dependencies["kakaotalk-chat-analyzer"]` 범위를 조정하고 래퍼 `version`도 올린다.
- **문서만** 변경(README·`docs/`·`kcachat/README`·`AGENTS.md`) → npm `version` bump **불필요**. `docs/` 푸시 후 **Deploy GitHub Pages** 성공만 확인한다.

`npm run build`는 `scripts/sync-version.mjs` → CSS 번들 → `tsc` 순이다([`package.json`](package.json)).

## 3. 포크·복제 저장소

`npm-publish.yml`은 `github.repository == 'claudianus/kakaotalk-chat-analyzer'`일 때만 퍼블리시한다. 포크에서 돌리려면 해당 조건을 자기 저장소로 바꾸고 자기 `NPM_TOKEN`을 넣는다.

## 4. GitHub Pages

`docs/` 변경은 기존 **Deploy GitHub Pages** 워크플로로 배포된다. npm과 별개이다.

## 5. 리포트 시각 QA (강제)

리포트 HTML·차트·Wrapped·키워드·테마·레이아웃을 **조금이라도** 손댄 뒤 `main` 반영 전, 에이전트가 **직접** 시각 QA한다. “`npm test`만 통과”로 끝내지 않는다. 사용자에게 브라우저 확인만 넘기는 것도 금지.

**체크리스트:**
1. 리포트를 브라우저에서 열어 전체 스크롤 확인
2. 차트·Wrapped·키워드 섹션 렌더링 확인
3. 다크/라이트 테마 모두 확인
4. 모바일 뷰포트 확인
5. 이상 발견 시 즉시 수정 후 재확인

## 6. 사용자 문서 동기화 (배포 가치 있는 UI/CLI 변경 후)

`main` 푸시 전·후 에이전트 체크리스트:

1. [README.md](README.md) **최근** 표 + **리포트 UX** (동작이 바뀐 경우)
2. [docs/index.html](docs/index.html) pill·히어로 — `npm run sync-docs-version` 후 `npm run check:docs-version` (pill·manifest·README 최상단 행). 리포트 UI가 바뀌면 `npm run docs:capture-demo` 로 `docs/assets/demo/` 스크린샷 갱신
3. [kcachat/README.md](kcachat/README.md) — 래퍼 env·동작 변경 시만
4. `docs/` 변경 시 **Deploy GitHub Pages** Actions 성공 확인
5. 공유 URL(BrewPage)은 **재생성·재업로드** 후 브라우저로 provenance·차트 확인
