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

## 1. 커밋·푸시 후 npm 배포 (강제)

`main`에 **배포 가치가 있는 변경**(소스·`dist/`·`package.json`·`kcachat/` 등)을 커밋하고 `git push origin main`까지 했다면, **아래를 반드시 이행**할 것. “푸시만 하고 끝”은 허용하지 않는다.

### A. GitHub Actions (기본 경로)

1. 저장소 **Settings → Secrets and variables → Actions**에 **`NPM_TOKEN`**이 있어야 한다(위 **`0. 최초 세팅`** 또는 스크립트로 등록).  
   - **새 패키지 이름**(`kcachat` 최초 등록)까지 CI에서 올리려면, 일반 로그인용 토큰이 아니라 npm 문서 기준의 **Automation / Granular publish** 토큰을 쓴다.
2. 푸시가 `.github/workflows/npm-publish.yml`의 `paths`에 걸리면 워크플로가 돌고, **레지스트리 버전보다 `package.json`의 `version`이 새로울 때만** `npm publish`한다.
3. 에이전트는 푸시 직후 **Actions 탭에서 해당 워크플로 성공 여부**를 확인하거나, 사용자에게 확인을 요청한다.

### B. 로컬에서 직접 배포할 때

`NPM_TOKEN`을 쓰지 않고 로컬에서 올릴 경우:

1. `npm whoami`로 로그인 확인. 퍼블리시는 npm 정책상 **2FA 또는 publish 가능한 granular 토큰**이 필요하다.
2. 루트에서: `npm test` 후 `npm publish --access public`
3. 그다음: `cd kcachat && npm install && npm publish --access public`  
   (**본체를 먼저** 올린 뒤 래퍼를 올린다.)

로컬 배포를 했다면 Actions가 중복 퍼블리시하지 않도록 **이미 레지스트리와 같은 `version`이면 워크플로는 스킵**된다.

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

## 5. 리포트 시각 QA (강제 — 사용자 노가다 금지)

리포트 HTML·차트·Wrapped·키워드·테마·레이아웃에 **조금이라도** 손댄 뒤 `main` 푸시·배포 전에, 에이전트가 **직접** 아래를 수행한다. “`npm test`만 통과했습니다”로 끝내지 않는다.

### A. 자동 생성

1. `npm test` 통과 후 **`npm run report:qa`** 실행한다.  
   - 기본: `~/Downloads`의 `KakaoTalk*.csv` 중 **최신 2개** → `.qa-reports/<slug>/index.html`  
   - 전부: `npm run report:qa -- --all`  
   - 시맨틱 끄고 빠르게: `KCA_NO_SEMANTIC=1 npm run report:qa`  
   - CSV 폴더 변경: `KCA_QA_CSV_DIR=~/Downloads npm run report:qa`
2. 스크립트가 HTML 구조( Wrapped·ECharts·키워드·참여자 ) 1차 검사를 한다. 실패 시 수정 후 재실행.
3. **별도 터미널(백그라운드)** 에 `npm run report:qa:serve` → `http://127.0.0.1:18765/<slug>/`  
   (브라우저 MCP는 `file://` 불가. manifest의 `httpUrl` 사용.)

### B. 브라우저 검수 (에이전트 필수)

`manifest.json`의 각 **`httpUrl`** 에 대해 **cursor-ide-browser**로 연다 (`browser_navigate` → 스냅샷·스크린샷).

| 확인 항목 | 기준 |
|-----------|------|
| Wrapped | 카드·한글 수치·빈 블록 없음 |
| ECharts | 워드클라우드·시간대·잔디·키워드·**주제 맵** 로드, 빈 차트 없음 |
| 키워드 | 상위어가 방 주제와 맞음, 잡음·깨진 2-gram 없음 |
| 참여자 | 말풍선·마스킹·랭킹 표 |
| 테마 | 라이트 / 다크 / 시스템 |
| 반응형 | ~390px 폭에서 겹침·가로 스크롤 폭주 없음 |
| 콘솔 | `browser_console_messages`에 치명적 에러 없음 |
| **Provenance** | 사이드 카드 `kca x.y.z`, `<details>리포트 정보`, footer·`#kca-provenance` JSON 버전 일치 |

스크린샷 또는 스냅샷으로 **최소 1장면(Wrapped + 차트 1개 + 키워드)** 을 확인한 뒤, 이슈가 있으면 고치고 **report:qa 재실행**한다. 로컬·CI 회귀용: `npm run report:screenshots -- <slug>` (Playwright, 390/834/1440/2560 full-page).

BrewPage 등 **이미 올린 URL** 검증: HTML만 curl/grep으로 UI를 판단하지 말고 **브라우저**로 확인. `grep kca-provenance` 또는 **생성 도구** 줄로 kca 버전을 본다.

### C. 완료 보고

PR·커밋·배포 완료 메시지에 반드시 포함:

- 실행한 명령 (`report:qa` 옵션, CSV 개수)
- 검수한 `http://127.0.0.1:18765/...` URL(또는 slug)
- npm **본체 버전** + (있으면) 검수한 리포트 HTML의 **generator/provenance 버전**
- 시각 QA에서 본 문제·수정 여부 (없으면 “시각 QA 이상 없음”)

**사용자에게 “브라우저에서 직접 확인해 주세요”만 남기고 끝내는 것은 금지**한다. 확인은 에이전트 몫이다.

### D. UX 전문가 리뷰 (리포트 UI/UX 변경 시)

`skills/kca-report-ux.md` 페르소나·체크리스트로 **비판적 컨설팅** 후 P0/P1은 같은 세션에서 수정한다. (내비·중복 콘텐츠·모바일·첫 화면 스캔 가능성)

## 6. 사용자 문서 동기화 (배포 가치 있는 UI/CLI 변경 후)

`main` 푸시 전·후 에이전트 체크리스트:

1. [README.md](README.md) **최근** 표 + **리포트 UX** (동작이 바뀐 경우)
2. [docs/index.html](docs/index.html) pill·히어로 — `node scripts/sync-docs-version.mjs` 로 pill을 `package.json`과 맞춤. 리포트 UI가 바뀌면 `npm run docs:capture-demo` 로 `docs/assets/demo/` 스크린샷 갱신
3. [kcachat/README.md](kcachat/README.md) — 래퍼 env·동작 변경 시만
4. `docs/` 변경 시 **Deploy GitHub Pages** Actions 성공 확인
5. 공유 URL(BrewPage)은 **재생성·재업로드** 후 브라우저로 provenance·차트 확인
