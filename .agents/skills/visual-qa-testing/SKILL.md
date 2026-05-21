---
name: visual-qa-testing
description: kca 리포트 시각 QA — report:qa, 브라우저 검수, provenance, 완료 보고 (리포트/UI 변경 시 필수)
---

# kca 리포트 시각 QA (강제)

리포트·차트·Wrapped·키워드·테마·레이아웃 변경 후 `main` 반영 전 에이전트가 직접 수행한다.

## A. 자동 생성

1. `npm test` 통과 후 **`npm run report:qa`**
   - 기본: `~/Downloads`의 `KakaoTalk*.csv` 중 **최신 2개** → `.qa-reports/<slug>/index.html`
   - 전부: `npm run report:qa -- --all`
   - 시맨틱 끄고 빠르게: `KCA_NO_SEMANTIC=1 npm run report:qa`
   - CSV 폴더: `KCA_QA_CSV_DIR=~/Downloads npm run report:qa`
2. 스크립트가 HTML 구조(Wrapped·ECharts·키워드·참여자) 1차 검사. 실패 시 수정 후 재실행. 대용량 코퍼스는 키워드 df 하한 통과.
3. **별도 터미널(백그라운드)** `npm run report:qa:serve` → `http://127.0.0.1:18765/<slug>/`
   - Playwright: `node scripts/report-viewport-check.mjs <slug> --playwright` (CI `report-visual-qa.yml`과 동일)
   - 브라우저 MCP는 `file://` 불가 — `manifest.json`의 `httpUrl` 사용

## B. 브라우저 검수 (cursor-ide-browser)

각 `httpUrl`에 `browser_navigate` → 스냅샷·스크린샷.

| 확인 | 기준 |
|------|------|
| Wrapped | 카드·한글 수치·빈 블록 없음 |
| ECharts | 워드클라우드·시간대·잔디·키워드·**주제 맵** 로드, 빈 차트 없음 |
| 키워드 | 상위어가 방 주제와 맞음, 잡음·깨진 2-gram 없음 |
| 참여자 | 말풍선·마스킹·랭킹 표 |
| 테마 | 라이트 / 다크 / 시스템 |
| 반응형 | ~390px에서 겹침·가로 스크롤 폭주 없음 |
| 콘솔 | 치명적 에러 없음 (`bootDyadWhenVisible`, `[kca-chart]` 0건) |
| Provenance | 사이드 `kca x.y.z`, `<details>리포트 정보`, footer·`#kca-provenance` JSON 버전 일치 |

최소 1장면(Wrapped + 차트 1개 + 키워드) 확인 후 이슈 시 `report:qa` 재실행. 회귀: `npm run report:screenshots -- <slug>` (390/834/1440/2560).

BrewPage 등 공유 URL: curl/grep으로 UI 판단 금지 — **브라우저**로 provenance·차트 확인.

## C. 완료 보고 (PR·배포 메시지에 포함)

- 실행 명령 (`report:qa` 옵션, CSV 개수)
- 검수한 `http://127.0.0.1:18765/...` URL(또는 slug)
- npm **본체 버전** + 리포트 HTML **generator/provenance** 버전
- 시각 QA 이슈·수정 여부 (없으면 “시각 QA 이상 없음”)

## D. UX 리뷰 (UI/UX 변경 시)

스킬 **`kca-report-ux`**: 비판적 컨설팅 후 P0/P1은 같은 세션에서 수정.

## MCP 요약

1. `npm run report:qa` → manifest `httpUrl`
2. `npm run report:qa:serve` (백그라운드)
3. `browser_navigate` → `browser_snapshot` / 스크린샷
4. `browser_console_messages`, 필요 시 `browser_resize` (~390px)
5. 위 완료 보고 형식으로 기록
