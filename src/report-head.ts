/** 리포트 `<head>` 외부 리소스 — 단일 HTML 오프라인 우선, 폰트·차트 CDN만 허용 */
export const REPORT_HEAD_LINKS = `
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
`;
