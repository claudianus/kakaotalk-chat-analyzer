# 에이전트 지침 (인덱스)

Cursor는 `.cursor/rules/*.mdc`를 우선 로드한다. Claude Code 등 다른 에이전트는 이 파일 + 아래 규칙 경로를 참고.

## 프로젝트 한 줄

카카오톡 CSV → 로컬 분석 → 단일 HTML 리포트. npm 패키지 2개: **`kakaotalk-chat-analyzer`** (본체 `kca`), **`kcachat`** (`npx` 래퍼).

## 규칙 맵

| 규칙 | 적용 | 내용 |
|------|------|------|
| [000-context-maintenance.mdc](.cursor/rules/000-context-maintenance.mdc) | 항상 | 스택 대변 시 규칙 재검토 제안 |
| [kca-project-core.mdc](.cursor/rules/kca-project-core.mdc) | 항상 | 도메인·스택·디렉터리·`npm test` |
| [cubic-pr-workflow.mdc](.cursor/rules/cubic-pr-workflow.mdc) | 항상 | PR → cubic → 머지 (main 직접 푸시 금지) |
| [kca-report-visual-qa.mdc](.cursor/rules/kca-report-visual-qa.mdc) | 리포트 glob | 시각 QA — 에이전트가 브라우저로 직접 검수 |
| [kca-report-ux.mdc](.cursor/rules/kca-report-ux.mdc) | 리포트 glob | UX 페르소나, P0/P1 같은 세션 수정 |
| [kca-npm-release.mdc](.cursor/rules/kca-npm-release.mdc) | package.json 등 | NPM_TOKEN·버전·publish |
| [kca-korean-nlp.mdc](.cursor/rules/kca-korean-nlp.mdc) | NLP/키워드 glob | Kiwi·임베딩·키워드 파이프 |
| [kca-llm-deck.mdc](.cursor/rules/kca-llm-deck.mdc) | llm glob | Story Deck, 원문 미전송 |
| [kca-docs-sync.mdc](.cursor/rules/kca-docs-sync.mdc) | docs glob | README·Pages·데모 스크린샷 |

## 빠른 체크리스트

**기능/버그 PR**

1. `feat/…` 또는 `fix/…` 브랜치
2. `npm test` (리포트/UI → visual-qa 규칙 추가)
3. `gh pr create` → cubic pass + Open Issues 0 → `gh pr merge`
4. 머지 후 npm Actions 또는 [kca-npm-release.mdc](.cursor/rules/kca-npm-release.mdc)

**리포트 UI 변경**

1. `npm run report:qa` + 브라우저 검수 (visual-qa)
2. UX 변경 시 `kca-report-ux.mdc`
3. `docs:capture-demo` + docs-sync

**문서만**

- npm version bump 불필요 · GitHub Pages deploy 확인

## NPM_TOKEN (최초 1회)

`bash scripts/sync-npm-token-to-gh.sh` — 상세는 [kca-npm-release.mdc](.cursor/rules/kca-npm-release.mdc).
