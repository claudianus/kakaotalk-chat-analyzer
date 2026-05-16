<div align="center">

# KakaoTalk Chat Analyzer

### 카카오톡 CSV보내기 → 익명 집계 리포트 → 선택적 임시 공유 · 한 번에 끝내는 CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-3b82f6?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-8b5cf6?style=flat-square&logo=github)](https://claudianus.github.io/kakaotalk-chat-analyzer/)

[**랜딩 페이지**](https://claudianus.github.io/kakaotalk-chat-analyzer/) · [**소스 코드**](https://github.com/claudianus/kakaotalk-chat-analyzer) · [**이슈 트래커**](https://github.com/claudianus/kakaotalk-chat-analyzer/issues)

<br>

<img src="https://readme-typing-svg.demolab.com?font=DM+Sans&weight=700&size=22&pause=1200&color=3EE8C5&center=true&vCenter=true&width=780&lines=Privacy-first+chat+analytics+for+KakaoTalk+CSV+exports;Single-file+HTML+reports+%2B+optional+zero-login+hosting" alt="tagline animation" />

</div>

---

## 왜 이 프로젝트인가요?

카카오톡 대화를 **CSV로 보낸 뒤**, 팀·친구·커뮤니티에 **재미있는 통계**를 공유하고 싶을 때가 있습니다.  
그런데 원문 그대로 올리기엔 **개인정보·민감 URL** 리스크가 큽니다.

**`kca`(KakaoTalk Chat Analyzer)**는 메시지 본문을 **리포트 파일에 저장하지 않고**, 집계 통계만 담은 **단일 `index.html`**을 생성합니다. 필요하면 **가입 없이** 임시 HTML 호스트에 올려 링크로 공유할 수 있습니다.

> 이 도구는 카카오 공식 제품이 아닙니다. 보낸 CSV 형식 변경에 따라 파싱이 깨질 수 있으니, 중요한 데이터는 항상 백업하세요.

---

## 핵심 기능

| 영역 | 설명 |
|------|------|
| **인코딩** | UTF-8 BOM, UTF-8, CP949/EUC-KR 등 보내기 인코딩 자동 감지 |
| **파싱** | `Date,User,Message` 헤더 기반 CSV + 멀티라인 메시지 처리 |
| **리포트** | 참여자·일별·시간대·요일·첨부 유형·도메인·키워드 등 **집계만** 시각화 |
| **배포** | BrewPage(기본) / TempFile / Cloudflare 등 **TTL 기반** 임시 호스팅 연동 |
| **프라이버시** | 원문 미포함, 참여자 **별칭** 표기, URL은 **호스트(도메인)** 단위만 집계 |

---

## 빠른 시작

### 요구 사항

- [Node.js](https://nodejs.org/) **22 이상**

### 설치 (로컬 개발)

```bash
git clone https://github.com/claudianus/kakaotalk-chat-analyzer.git
cd kakaotalk-chat-analyzer
npm install
npm run build
```

### 명령어

```bash
# 1)보내기 구조 점검 (대화 원문은 출력하지 않음)
kca inspect path/to/KakaoTalk_Chat_....csv

# 2) 로컬에 익명 리포트 생성 → report/index.html
kca analyze path/to/KakaoTalk_Chat_....csv -o ./report

# 3) 리포트 생성 후 임시 호스팅까지 (기본: BrewPage, TTL 최대 30일)
kca publish path/to/KakaoTalk_Chat_....csv
```

글로벌 설치 없이 실행하려면:

```bash
node dist/src/cli.js publish ./KakaoTalk_Chat_....csv
```

`publish` 실패 시에도 **로컬 HTML은 남습니다**. BrewPage 대신 TempFile을 쓰려면:

```bash
kca publish ./chat.csv --host tempfile --ttl 30
```

---

## 프라이버시 기본값

- 참여자 이름은 **`User 001` 형태의 안정적인 별칭**으로만 리포트에 표시됩니다.
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
   → analysis (집계·별칭·키워드/도메인 등)
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

프로젝트 소개·시작 가이드가 담긴 정적 사이트는 **GitHub Actions**로 배포됩니다.

- **URL:** [https://claudianus.github.io/kakaotalk-chat-analyzer/](https://claudianus.github.io/kakaotalk-chat-analyzer/)

### 첫 설정 팁

저장소를 포크하거나 새로 만들었다면, 한 번 확인하세요.

1. **Settings → Pages**
2. **Build and deployment → Source:** `GitHub Actions` 선택  
3. `main` 브랜치에 푸시되면 워크플로 **Deploy GitHub Pages**가 실행됩니다.

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
