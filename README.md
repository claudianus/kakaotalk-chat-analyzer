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

<img src="https://readme-typing-svg.demolab.com?font=DM+Sans&weight=700&size=22&pause=1200&color=3EE8C5&center=true&vCenter=true&width=780&lines=Streaming+analytics+for+months+of+KakaoTalk+CSV;ECharts+charts+%2B+120+keywords+%2B+one-line+share" alt="tagline animation" />

</div>

---

## 목차

- [왜 이 프로젝트인가요?](#왜-이-프로젝트인가요)
- [핵심 기능](#핵심-기능)
- [대용량·속도](#대용량속도)
- [리포트 UX](#리포트-ux)
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

**`kca`(KakaoTalk Chat Analyzer)**는 메시지 본문을 **리포트 파일에 저장하지 않고**, 집계 통계만 담은 **단일 `index.html`**을 생성합니다. 몇 개월·수십만 줄 규모도 **파일 전체를 RAM에 올리지 않는 스트리밍 집계**로 처리하고, 리포트는 **한글 프리미엄 UI**(채팅방 이름·히트맵·오전/오후 리듬·인사이트 카드)로 바로 읽을 수 있습니다. 기본은 참여자 **부분 마스킹**, 필요 시 **가입 없이** BrewPage 등에 올려 링크로 공유합니다.

> 이 도구는 카카오 공식 제품이 아닙니다. 보낸 CSV 형식 변경에 따라 파싱이 깨질 수 있으니, 중요한 데이터는 항상 백업하세요.

---

## 핵심 기능

| 영역 | 설명 |
|------|------|
| **인코딩** | UTF-8 BOM, UTF-8, CP949/EUC-KR 등 보내기 인코딩 자동 감지 |
| **파싱** | `Date,User,Message` 헤더 기반 CSV + 멀티라인 메시지 처리 |
| **리포트** | Wrapped·**ECharts** 차트(워드클라우드·히트맵)·**Kiwi+TF-IDF** 키워드 120개·잔디 그리드·인사이트 등 **집계 전용** 시각화 |
| **성능** | 줄 단위 스트림 파싱 · 단일 패스 집계 · 3MB+ Worker · 진행 표시(`--progress`) |
| **배포** | BrewPage(기본) / TempFile / Cloudflare 등 **TTL 기반** 임시 호스팅 · iframe 공유 링크 안전 처리 |
| **npx** | 짧은 별칭 **[`kcachat`](https://www.npmjs.com/package/kcachat)** 또는 본체 **`kakaotalk-chat-analyzer`** |
| **프라이버시** | 원문 미포함, 참여자 **부분 마스킹 표시명**(기본), URL은 **도메인**만 집계 |

---

## 대용량·속도

카카오 보내기 CSV는 **일반 표 CSV가 아니라** “날짜 줄 + 이어지는 본문” 형식입니다. `kca`는 이 형식에 맞춘 **전용 스트림 파서**로 읽고, 메시지마다 통계만 누적한 뒤 **본문은 즉시 버립니다**.

| 설계 | 효과 |
|------|------|
| **스트리밍 파싱** | 파일 전체를 문자열/배열로 펼치지 않음 |
| **단일 패스 집계** | `Map`·히스토그램·온라인 통계(간격 P90 등)만 유지 |
| **Worker (≥3MB)** | 대용량일 때 메인 스레드 멈춤 완화 |
| **키워드** | **Kiwi** 형태소 + TF-IDF·PMI + 해시태그 보조(최대 120개, 모델 최초 1회 무료 다운로드) |
| **kcachat@latest** | 실행 시 `kakaotalk-chat-analyzer@latest` 본체를 받아 최신 CLI 사용 |

로컬 벤치(합성 20만 메시지, 집계만): **약 0.4초대** — 환경·디스크·실제 대화 밀도에 따라 달라집니다.

```bash
# 진행 상황 (2.5만 건마다 stderr)
npx kcachat@latest "./KakaoTalk_Chat_....csv" --progress

# 단계별 ms (Worker 끔)
npx kcachat@latest "./KakaoTalk_Chat_....csv" --profile --no-worker

# 개발용 벤치
npm run bench:stream -- 100000
```

> 외부 DB(DuckDB 등) 없이 **Node.js만**으로 동작합니다. 의존성·설치 부담을 줄이기 위한 선택입니다.

---

## 리포트 UX

생성되는 `index.html`은 **브라우저만** 있으면 열리는 단일 파일입니다. (인터랙티브 차트는 CDN으로 ECharts를 불러옵니다.)

- **⓪ Wrapped**: 채팅방 규모·리듬·MVP·급증일 등 카드형 한 장면 요약
- **빠른 이동**: Wrapped · 숫자 요약 · 인터랙티브 차트 · 표·막대 모음 · 용어 설명
- **인터랙티브 차트**: 워드클라우드, 시간대·요일·월별, 일별 캘린더 히트맵, 키워드 막대(80) + **전체 120개 표**
- **연간 잔디**: 활동 **기간만** 주 단위(53주 고정 아님), 호버 시 건수 툴팁
- **숫자·인사이트**: 지니(참여 쏠림)·리듬 점수·응답 간격(초/분 한국어) 등
- **키워드**: **Kiwi** 명사·고유명사 + **TF-IDF/PMI** + 메시지 **등장 횟수**, 오픈채팅·잡음어 필터
- **참여자**: 말풍선 맵 + 마스킹 닉네임 + 랭킹 테이블
- **BrewPage**: iframe 섹션 점프·외부 링크 안전 처리
- **테마**: 라이트 / 다크 / 시스템

원문 메시지·전체 URL은 HTML에 넣지 않습니다(BrewPage 5MiB 한도 고려). **이미 올린 링크는 재업로드해야** UI가 바뀝니다.

### 최근

| 버전 | 요약 |
|------|------|
| **0.4.2** | 키워드 병합(공백+Kiwi)·브랜드 표기 통합·구 dedupe 제거, **진행률 % 기본 표시** |
| **0.4.1** | Kiwi CI 캐시, `keyword:diff` 스크립트, `KCA_NO_KIWI`, 잡음어·장문 절단 |
| **0.4.0** | **Kiwi** 형태소 + TF-IDF·PMI 키워드 (KR-WordRank 제거) |
| **0.3.3** | 하이라이트 문구, 키워드 꼬리 필터, 팩트 매트릭스 중복 정리 |
| **0.3.2** | 키워드 메시지 히트수, 지니·만/억 표기, 차트 리사이즈 |
| **0.3.1** | ECharts 로드 순서 수정(빈 차트), 복붙·환영 문구 한국어 |
| **0.3.0** | ECharts 섹션, 키워드 120, 2026 글래스 UI, Wrapped·잔디 개선 |

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

> **버전:** `kcachat@latest`는 본체 `kakaotalk-chat-analyzer@latest`를 매 실행 받습니다. 고정하려면 `npx kakaotalk-chat-analyzer@0.4.1`. 오프라인은 `kcachat … --bundled`. ([kcachat README](kcachat/README.md))

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

# 보내기 구조 점검(원문 출력 없음, 스트리밍)
kca inspect ./KakaoTalk_Chat_....csv

# 대용량 진행 표시 / 프로파일
kca ./chat.csv --progress
kca ./chat.csv --profile --no-worker

kca --help
```

업로드가 실패해도 **로컬 `index.html`은 남습니다**.

---

## 생성되는 리포트

- **단일 `index.html`**: CSS·차트·안내 문구가 **한 파일에 포함**되어 오프라인에서도 동작합니다.
- **원문 미저장**: 메시지 본문은 통계 계산에만 사용되며 HTML에 남기지 않습니다.
- **재업로드 안내**: 예전 BrewPage 링크는 생성 시점 HTML이 고정됩니다. UI·버그 수정 후에는 **다시 업로드**해야 반영됩니다.
- 자세한 화면 구성은 [리포트 UX](#리포트-ux)를 참고하세요.

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
CSV 파일 (스트림 read)
   → 인코딩 샘플(512KB) + 줄 단위 Kakao 파서
   → ReportAggregator (단일 패스 · 메시지 본문 비보관)
        ├─ [≥3MB] Worker 스레드 (선택)
        └─ Gap/키워드 온라인 통계
   → report.ts (단일 HTML, 다크/라이트)
   → [선택] providers → BrewPage / TempFile / Cloudflare
```

`kcachat`는 npm에서 **짧은 이름**으로 위 파이프라인을 실행하는 래퍼입니다.

---

## 개발

```bash
npm install
npm run build
npm test
```

---

## 문서 사이트 (GitHub Pages)

### Kiwi 모델·환경 변수

- **최초 실행** 시 GitHub에서 Kiwi 한국어 모델을 **무료**로 받아 `~/.cache/kakaotalk-chat-analyzer/kiwi-base/`에 둡니다.
- **`KCA_NO_KIWI=1`**: 형태소 없이 휴리스틱만(빠름, 품질↓).
- **진행률**: 기본으로 stderr에 `대화 분석 42% (…)` 표시. 끄려면 `--no-progress`.
- **키워드 비교**: `npm run keyword:diff -- ./KakaoTalk_Chat_....csv 30`
- LGPL 고지: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

랜딩 페이지(`docs/index.html`)는 **v0.4.x 리포트 UX·ECharts·Kiwi 키워드** 요약과 **복사 가능한 `npx` 예시**를 담은 단일 HTML이며, **GitHub Actions**가 `main`에 `docs/` 변경을 푸시할 때마다 배포합니다.

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
