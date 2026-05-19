---
name: visual-qa-testing
description: Visually QA a web application by launching it in Cursor's built-in browser, taking screenshots, checking console errors, and auditing network requests. Use after making UI changes to verify they look correct.
---

# Visual QA

Use this skill after making UI changes to visually verify the result, catch console errors, and audit network requests — all without leaving Cursor.

## kakaotalk-chat-analyzer

- 리포트 HTML 변경 후: `npm run report:qa` → `npm run report:qa:serve` → `http://127.0.0.1:18765/<slug>/` (`manifest.json`의 `httpUrl`).
- `npm run dev` 없음. Playwright 스크립트: `node scripts/report-viewport-check.mjs <slug> --playwright`.
- 상세·Provenance: `AGENTS.md` §5, 스킬 `kca-report-ux`.

## How It Works

Cursor has a built-in browser (`cursor-ide-browser` MCP) that can navigate to URLs, take screenshots, read console messages, inspect network requests, and interact with page elements.

## Steps (kca 리포트)

1. **리포트 생성** — `npm test` 통과 후:

   ```bash
   npm run report:qa
   ```

   `.qa-reports/manifest.json`에서 검수할 `httpUrl` 확인.

2. **QA 서버 기동** — 별도 터미널(백그라운드):

   ```bash
   npm run report:qa:serve
   ```

   기본 포트 `18765`. 이미 떠 있으면 재사용.

3. **브라우저로 열기** — `browser_navigate`로 manifest의 `httpUrl` 사용 (`file://` 불가):

   ```
   Tool: browser_navigate
   Arguments: { "url": "http://127.0.0.1:18765/<slug>/", "take_screenshot_afterwards": true }
   ```

4. **스크린샷·스냅샷** — Wrapped, ECharts, 키워드, 참여자, provenance(`kca x.y.z`) 확인.

5. **콘솔·네트워크** — `browser_console_messages`, `browser_network_requests`로 치명적 에러·4xx/5xx 확인.

6. **테마·반응형** — 라이트/다크/시스템, ~390px 폭에서 겹침·가로 스크롤 확인.

7. **보고** — 실행 명령, 검수 URL, npm·provenance 버전, 발견 이슈·수정 여부.

## Notes

- Always use `browser_snapshot` before clicking elements to get the correct element refs.
- For responsive testing, use `browser_resize` to check different viewport sizes.
- Use `browser_navigate` with `position: "side"` to open the browser beside your code.
