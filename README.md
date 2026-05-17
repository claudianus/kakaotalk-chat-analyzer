<div align="center">

# KakaoTalk Chat Analyzer

### 카카오톡 CSV 보내기 → 터미널 한 줄 → 브라우저 리포트 링크

[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-3b82f6?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-8b5cf6?style=flat-square&logo=github)](https://claudianus.github.io/kakaotalk-chat-analyzer/)
[![npm · kcachat](https://img.shields.io/npm/v/kcachat?label=npm%20kcachat&color=cb3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/kcachat)

[**랜딩 (GitHub Pages)**](https://claudianus.github.io/kakaotalk-chat-analyzer/) · [**소스**](https://github.com/claudianus/kakaotalk-chat-analyzer) · [**이슈**](https://github.com/claudianus/kakaotalk-chat-analyzer/issues)

```bash
npx kcachat@latest
```

[Node.js 22+](https://nodejs.org/) · 설치 없이 `npx` · CSV 경로 생략 가능 · [`--local`](#업로드-없이-내-pc에만)

<table>
  <tr>
    <td align="center" width="33%"><strong>Wrapped</strong><br><img src="docs/assets/demo/wrapped.png" alt="Wrapped 요약" width="100%" /></td>
    <td align="center" width="33%"><strong>차트</strong><br><img src="docs/assets/demo/charts-viz.png" alt="차트" width="100%" /></td>
    <td align="center" width="33%"><strong>키워드</strong><br><img src="docs/assets/demo/keywords.png" alt="키워드" width="100%" /></td>
  </tr>
</table>

<p><sub><a href="https://claudianus.github.io/kakaotalk-chat-analyzer/#demo">리포트 미리보기 전체</a> (12장 · 탭하면 크게 보기)</sub></p>

</div>

---

## 목차

**처음 쓰는 분**

- [3분 안에 시작하기](#3분-안에-시작하기)
- [리포트에서 볼 수 있는 것](#리포트에서-볼-수-있는-것)
- [개인정보·공유 전에](#개인정보공유-전에)
- [자주 묻는 질문](#자주-묻는-질문)

**더 쓰고 싶을 때**

- [옵션·고급](#옵션고급)
- [최근 업데이트](#최근-업데이트)

**개발자**

- [개발·기여](#개발기여)
- [문서 사이트 (GitHub Pages)](#문서-사이트-github-pages)

---

## 3분 안에 시작하기

### 1. 카카오톡에서 CSV 보내기

1. PC 카카오톡에서 채팅방 열기  
2. **더보기(≡)** → **대화 보내기** → **CSV 보내기**

파일명은 보통 `KakaoTalk_Chat_…` 형태입니다. **원문이 들어 있는 파일**이므로 다른 사람에게 보내기 전에 내용을 확인하세요.

### 2. 터미널에서 한 줄 실행

[Node.js 22+](https://nodejs.org/)가 설치되어 있어야 합니다.

**공유 링크까지 (기본)** — 저장 폴더에서 **가장 최근** CSV를 자동으로 고릅니다:

```bash
npx kcachat@latest
```

**내 PC에만 저장** (인터넷 업로드 없음):

```bash
npx kcachat@latest --local
```

| OS | 자동으로 찾는 폴더 |
|----|-------------------|
| **Windows** | `문서\카카오톡 받은 파일` (없으면 `문서\카카오톡` → `다운로드`) |
| **Mac** | `다운로드` (Downloads) |

다른 폴더를 쓰려면: `KCA_CSV_DIR=~/Desktop npx kcachat@latest`

### 3. 링크 열기

터미널에 나온 **URL**을 브라우저에서 열면 Wrapped·차트·키워드가 있는 리포트를 볼 수 있습니다.

- **최초 1회**는 한국어 분석 모델 다운로드로 **1~3분** 걸릴 수 있습니다.  
- 이미 올린 예전 링크는 **다시 실행·업로드**해야 UI가 바뀝니다.

### 파일을 직접 고르고 싶을 때

```bash
npx kcachat@latest latest --list      # 후보 목록
npx kcachat@latest latest --pick 1    # 두 번째로 최근 파일
npx kcachat@latest "C:\경로\KakaoTalk_Chat_....csv"
```

> 카카오 **공식 앱이 아닙니다.** 보내기 CSV 형식이 바뀌면 동작이 깨질 수 있으니 중요한 대화는 백업해 두세요.

---

## 리포트에서 볼 수 있는 것

브라우저만 있으면 되는 **단일 HTML**입니다. **대화 원문은 파일에 넣지 않습니다.**

| 구역 | 내용 |
|------|------|
| **Wrapped** | 한 장면 요약, 활동 달력, 페르소나·하이라이트 |
| **차트** | 워드클라우드, 요일·시간대, 주제 맵 |
| **키워드** | 상위 단어 순위 (한국어 형태소 + 통계) |
| **참여자** | 말풍선·랭킹 (이름은 **일부만** 보이게 마스킹) |
| **테마** | 라이트 / 다크 / 시스템 |

공유 링크(BrewPage 등)로 열어도 되고, `--local`로 만든 `index.html`을 더블클릭해도 됩니다.

---

## 개인정보·공유 전에

- 메시지 **본문은 리포트 HTML에 저장하지 않습니다** (집계에만 사용).
- 참여자 이름은 기본적으로 **앞·뒤만 남기고 가운데 마스킹**합니다.
- URL은 **도메인**만 집계합니다.
- 그래도 **키워드·통계**만으로 방 분위기가 드러날 수 있습니다. 링크를 보내기 전에 한 번 훑어 보세요.
- `--local`을 쓰면 기본적으로 **외부 업로드 없이** 내 PC에만 저장합니다.

---

## 자주 묻는 질문

**Q. Node.js가 없어요.**  
→ [nodejs.org](https://nodejs.org/)에서 LTS(22+) 설치 후 터미널을 다시 엽니다.

**Q. CSV를 못 찾는다고 해요.**  
→ 위 [OS별 폴더](#2-터미널에서-한-줄-실행)에 파일이 있는지 확인하거나, 경로를 직접 넣으세요.

**Q. 첫 실행이 너무 느려요.**  
→ Kiwi 한국어 모델을 **처음 한 번** 받는 중입니다. 이후에는 훨씬 빨라집니다.

**Q. 친구에게 링크만내면 되나요?**  
→ 네. 다만 통계·키워드가 방 성격을 드러낼 수 있으니 공유 범위는 스스로 판단하세요.

**Q. 예전에 만든 링크 UI가 옛날이에요.**  
→ 그 링크는 업로드 당시 HTML이 고정됩니다. CSV로 **다시 실행**해 새 링크를 받으세요.

**Q. `kcachat`와 `kakaotalk-chat-analyzer` 차이?**  
→ 같은 프로그램입니다. `kcachat`는 짧은 `npx` 이름입니다.

---

## 옵션·고급

<details>
<summary><strong>CLI 전체 옵션 (펼치기)</strong></summary>

```bash
# 기본: HTML 생성 후 BrewPage 업로드
kca ./KakaoTalk_Chat_....csv

# 업로드 없이 로컬만
kca ./chat.csv --local -o ./report

# 업로드 생략(드라이런)
kca ./chat.csv --dry-run

# 다른 호스트
kca ./chat.csv --host tempfile --ttl 30

# 보내기 구조 점검(원문 출력 없음)
kca inspect ./chat.csv

# 진행률 끄기 / 프로파일
kca ./chat.csv --no-progress
kca ./chat.csv --profile --no-worker

# 날짜 필터
kca ./chat.csv --since 2025-01-01

kca --help
```

업로드가 실패해도 **로컬 `index.html`은 남습니다.**

</details>

<details>
<summary><strong>성능·키워드·벤치 (개발·파워유저)</strong></summary>

- **스트리밍 파싱**: 대용량 CSV도 RAM에 통째로 올리지 않음  
- **진행률**: 기본 ON (`--no-progress`로 끔)  
- **시맨틱 키워드**: 한국어 방 기본 ON (`--no-semantic-keywords`로 끔)  
- CSV 옆 **`.kca-glossary.txt`**(한 줄에 한 단어) → Kiwi 사용자 사전 반영  

```bash
npx kcachat@latest "./chat.csv" --profile --no-worker
npm run bench:stream -- 100000   # 저장소 클론 후
```

</details>

**버전 고정:** `npx kakaotalk-chat-analyzer@0.16.1` · 최신은 `kcachat@latest`가 매번 본체를 받습니다. 리포트 사이드 카드·`#kca-provenance`로 실제 생성 버전을 확인할 수 있습니다.

**로컬 개발:**

```bash
git clone https://github.com/claudianus/kakaotalk-chat-analyzer.git
cd kakaotalk-chat-analyzer && npm install && npm run build && npm test
```

---

## 최근 업데이트

| 버전 | 요약 |
|------|------|
| **0.16.5** | 상호작용 히트맵: 말 많은 사람 축 상단·지연 로드·로딩 스켈레톤 |
| **0.16.4** | 대용량 방 키워드: minDf 스케일·메시지 수 우선 정렬·시맨틱은 BM25 후보만 보강 |
| **0.16.3** | 기본 **품질 우선** 프로필(메인 스레드·시맨틱 샘플 확대·RRF 완화·임베딩 주제). 가속은 `--worker` / `--fast` |
| **0.16.1** | Windows 기본 CSV 폴더 `문서\카카오톡 받은 파일` |
| **0.16.0** | 경로 생략·`latest --list/--pick`·진행률 추정·세션 gap |
| **0.15.0** | 모바일 참여자 카드·키워드 RRF·오픈채팅 인사이트 |
| **0.13.8** | burst·주제맵·벤치 UI |
| **0.13.3** | 리포트에 `kca` 버전(provenance) 표시 |

이전 버전: [Releases](https://github.com/claudianus/kakaotalk-chat-analyzer/releases)

---

## 개발·기여

```bash
npm install && npm run build && npm test
```

유용한 스크립트: `report:qa` · `report:screenshots` · `docs:capture-demo` · `bench:stream`

이슈·PR 환영합니다. 민감한 CSV·토큰은 이슈에 첨부하지 마세요.

**아키텍처 (요약):** CSV 스트림 → 집계(본문 비보관) → 단일 HTML → [선택] BrewPage 등 업로드.

---

## 문서 사이트 (GitHub Pages)

- **공개 URL:** [https://claudianus.github.io/kakaotalk-chat-analyzer/](https://claudianus.github.io/kakaotalk-chat-analyzer/)
- [`docs/index.html`](docs/index.html) — 시작 명령·OS별 폴더·짧은 팁
- `main`에 `docs/` 푸시 시 Actions가 배포 · pill 버전: `node scripts/sync-docs-version.mjs`

---

## 라이선스

[MIT License](./LICENSE)

<div align="center">

**Made with care for safer chat analytics** · [@claudianus](https://github.com/claudianus)

</div>
