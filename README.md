<div align="center">

# KakaoTalk Chat Analyzer

### 카카오톡 CSV 보내기 → 익명 집계 리포트 → 선택적 임시 공유 · 한 번에 끝내는 CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-3b82f6?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-8b5cf6?style=flat-square&logo=github)](https://claudianus.github.io/kakaotalk-chat-analyzer/)
[![npm · kcachat](https://img.shields.io/npm/v/kcachat?label=npm%20kcachat&color=cb3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/kcachat)
[![npm · 본체](https://img.shields.io/npm/v/kakaotalk-chat-analyzer?label=npm%20본체&color=cb3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/kakaotalk-chat-analyzer)

[**랜딩 (GitHub Pages)**](https://claudianus.github.io/kakaotalk-chat-analyzer/) · [**소스 코드**](https://github.com/claudianus/kakaotalk-chat-analyzer) · [**이슈**](https://github.com/claudianus/kakaotalk-chat-analyzer/issues)

<br>

<img src="https://readme-typing-svg.demolab.com?font=DM+Sans&weight=700&size=22&pause=1200&color=3EE8C5&center=true&vCenter=true&width=780&lines=Privacy-first+chat+analytics+for+KakaoTalk+CSV+exports;Single-file+HTML+reports+%2B+optional+zero-login+hosting" alt="tagline animation" />

</div>

---

## 목차

- [왜 이 프로젝트인가요?](#왜-이-프로젝트인가요)
- [핵심 기능](#핵심-기능)
- [카카오톡에서 CSV 보내기](#카카오톡에서-csv-보내기)
- [빠른 시작](#빠른-시작)
- [생성되는 리포트](#생성되는-리포트)
- [프라이버시 기본값](#프라이버시-기본값)
- [아키텍처 한눈에](#아키텍처-한눈에)
- [개발](#개발)
- [문서 사이트 (GitHub Pages)](#문서-사이트-github-pages)
- [기여하기](#기여하기)

---

## 왜 이 프로젝트인가요?

카카오톡 대화를 **CSV로 보낸 뒤**, 팀·친구·커뮤니티에 **재미있는 통계**를 공유하고 싶을 때가 있습니다.  
그런데 원문 그대로 올리기엔 **개인정보·민감 URL** 리스크가 큽니다.

**`kca`(KakaoTalk Chat Analyzer)**는 메시지 본문을 **리포트 파일에 저장하지 않고**, 집계 통계만 담은 **단일 `index.html`**을 생성합니다. 기본은 참여자 이름을 **부분 마스킹**해 방 안에서 누구인지 감은 오게 보여 주며, 필요하면 **가입 없이** 임시 HTML 호스트에 올려 링크로 공유할 수 있습니다.

> 이 도구는 카카오 공식 제품이 아닙니다. 보낸 CSV 형식 변경에 따라 파싱이 깨질 수 있으니, 중요한 데이터는 항상 백업하세요.

---

## 핵심 기능

| 영역 | 설명 |
|------|------|
| **인코딩** | UTF-8 BOM, UTF-8, CP949/EUC-KR 등 보내기 인코딩 자동 감지 |
| **파싱** | `Date,User,Message` 헤더 기반 CSV + 멀티라인 메시지 처리 |
| **리포트** | 한글 UI, 일별·시간대, 하이라이트, 월별·심야·응답 간격·키워드/도메인 등 **집계 전용** 시각화 |
| **배포** | BrewPage(기본) / TempFile / Cloudflare 등 **TTL 기반** 임시 호스팅 연동 |
| **npx** | 짧은 별칭 **[`kcachat`](https://www.npmjs.com/package/kcachat)** 또는 본체 **`kakaotalk-chat-analyzer`** |
| **프라이버시** | 원문 미포함, 참여자 **부분 마스킹 표시명**(기본), URL은 **도메인**만 집계 |

---

## 카카오톡에서 CSV 보내기

1. 카카오톡에서 분석할 **채팅방**을 엽니다.
2. 우측 상단 **더보기(≡)** → **대화 보내기** → **CSV 보내기**로 파일을 저장합니다. (파일명은 보통 `KakaoTalk_Chat_…` 형태입니다.)
3. 아래 [빠른 시작](#빠른-시작)의 `npx` 명령에 **저장한 파일 경로**를 넣어 실행합니다.

> iOS/Android 앱 버전에 따라 메뉴 문구가 조금 다를 수 있습니다. **메시지 원문이 포함된 CSV**이므로, 공유·업로드 전에 항상 내용을 확인하세요.

---

## 빠른 시작

### 요구 사항

- [Node.js](https://nodejs.org/) **22 이상**

### npx 한 줄 (추천)

**짧은 패키지명 [`kcachat`](https://www.npmjs.com/package/kcachat)** 으로 본체(`kakaotalk-chat-analyzer`)와 똑같이 실행할 수 있습니다.

**로컬에만** (`--local`: HTML만 만들고 기본 BrewPage 업로드는 생략. 출력 기본 `.tmp/kca-report`, `-o ./report`로 변경):

```bash
npx kcachat@latest "./KakaoTalk_Chat_....csv" --local
```

**리포트 생성 후 기본 호스트(BrewPage)로 업로드**:

```bash
npx kcachat@latest "./KakaoTalk_Chat_....csv"
```

전체 이름으로 실행해도 동일합니다:

```bash
npx kakaotalk-chat-analyzer@latest "./KakaoTalk_Chat_....csv" --local
```

GitHub 소스에서 직접:

```bash
npx github:claudianus/kakaotalk-chat-analyzer "./KakaoTalk_Chat_....csv" --local
```

### 로컬 클론 개발

```bash
git clone https://github.com/claudianus/kakaotalk-chat-analyzer.git
cd kakaotalk-chat-analyzer
npm install
npm run build
npm test
```

### CLI 요약

기본 동작은 **서브커맨드 없이** `<csv>` 한 개만 주면 됩니다.

```bash
# 기본: HTML 생성 후 BrewPage 업로드
kca ./KakaoTalk_Chat_....csv

# 업로드 없이 로컬만
kca ./KakaoTalk_Chat_....csv --local -o ./report

# 업로드 생략(드라이런)
kca ./KakaoTalk_Chat_....csv --dry-run

# TempFile 호스트
kca ./chat.csv --host tempfile --ttl 30

# 보내기 구조 점검(원문 출력 없음)
kca inspect ./KakaoTalk_Chat_....csv

kca --help
```

업로드가 실패해도 **로컬 `index.html`은 남습니다**.

---

## 생성되는 리포트

- **단일 `index.html`**: 오프라인으로 열어도 되는 **자급자족** 파일입니다(집계용 JSON은 `<script type="application/json">` 등으로 같은 파일 안에 포함).
- **원문 미저장**: 메시지 본문은 통계에만 쓰이고, 결과 HTML에는 넣지 않습니다.
- **하단 안내(선택적 홍보)**: 리포트 맨 아래에, 같은 도구로 **다른 대화**도 만들어 볼 수 있도록 `npx` 예시와 문서 링크가 **짧게** 들어갈 수 있습니다. 통계 본문과 겹치지 않도록 별도 박스로 구분되어 있습니다.

---

## 프라이버시 기본값

- 기본(`public-masked`)은 참여자 이름을 **앞·뒤 글자만 남기고 가운데 마스킹**합니다(동명이의 충돌 시 `·2`처럼 구분자가 붙을 수 있음). 완전 별칭(`User 001`)은 `--privacy public-anonymous` 로 선택할 수 있습니다.
- 메시지 텍스트는 **통계 계산에만** 사용되며, **생성된 HTML에 원문이 쓰이지 않습니다**.
- URL에서 **도메인**만 집계하고, 전체 URL 문자열은 리포트에 보존하지 않습니다.
- BrewPage **owner 토큰**은 로컬에 저장되어, 이후 링크 관리·삭제에 활용할 수 있습니다.

```bash
# 저장된 owner 토큰 삭제
kca token clear --host brewpage --ns kakao-chat-report
```

---

## 아키텍처 한눈에

```
CSV 파일
   → parser (인코딩·CSV·날짜 파싱)
   → analysis (집계·부분 마스킹·키워드/도메인·하이라이트 등)
   → report (단일 HTML 렌더)
   → [선택] providers (BrewPage / TempFile / Cloudflare 업로드)
```

---

## 개발

```bash
npm install
npm run build
npm test
```

---

## 문서 사이트 (GitHub Pages)

랜딩 페이지(`docs/index.html`)는 **저장소의 `docs/` 폴더**를 그대로 올리며, **GitHub Actions**가 `main`에 푸시될 때마다 배포합니다.

- **공개 URL:** [https://claudianus.github.io/kakaotalk-chat-analyzer/](https://claudianus.github.io/kakaotalk-chat-analyzer/)
- **워크플로:** [`.github/workflows/pages.yml`](.github/workflows/pages.yml)

### 저장소를 새로 쓸 때 (Pages 켜기)

1. GitHub **Settings → Pages**
2. **Build and deployment → Source:** **GitHub Actions** 선택
3. `main`에 푸시하면 **Deploy GitHub Pages** 워크플로가 `docs/`를 게시합니다. (최초 1회는 Actions 탭에서 권한/환경 승인이 필요할 수 있습니다.)

---

## 기여하기

이슈·PR·아이디어 모두 환영합니다. 큰 변경 전에는 이슈에서 방향을 먼저 짧게 나누면 리뷰가 빨라집니다.

1. Fork → 브랜치 생성  
2. `npm test` 통과  
3. PR 설명에 **동기(왜)** 와 **테스트 방법**을 적어 주세요.

---

## 보안

민감한 CSV나 토큰이 포함된 스크린샷은 **이슈/PR에 첨부하지 마세요**.  
취약점으로 보이는 내용은 비공개 채널(예: GitHub Security Advisories)로 알려 주시면 감사하겠습니다.

---

## 라이선스

[MIT License](./LICENSE)

---

<div align="center">

**Made with care for safer chat analytics** · [@claudianus](https://github.com/claudianus)

⭐ 이 프로젝트가 도움이 되었다면 스타 한 번 부탁드립니다.

</div>
