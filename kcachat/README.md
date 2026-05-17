# kcachat

카카오톡 대화 리포트 CLI [`kakaotalk-chat-analyzer`](https://www.npmjs.com/package/kakaotalk-chat-analyzer)를 **짧은 이름**으로 `npx` 실행하기 위한 래퍼입니다.

## 시작 (가장 흔한 경우)

```bash
npx kcachat@latest
```

- **경로 생략**: OS 기본 폴더에서 가장 최근 `KakaoTalk*.csv` 자동 선택  
- **Windows**: `문서\카카오톡 받은 파일`  
- **Mac**: `다운로드`  
- **업로드 없이**: `npx kcachat@latest --local`

자세한 설명·FAQ: [본 저장소 README](https://github.com/claudianus/kakaotalk-chat-analyzer#3분-안에-시작하기) · [랜딩](https://claudianus.github.io/kakaotalk-chat-analyzer/)

## 파일 고르기

```bash
npx kcachat@latest latest --list
npx kcachat@latest latest --pick 1
npx kcachat@latest "C:\경로\KakaoTalk_Chat_....csv"
```

## 버전·오프라인

- `kcachat@latest`는 실행 시 **본체 최신**을 받습니다 (`npx` 네트워크 필요).
- 확인: `npx kcachat@latest --version`
- 오프라인·고정: `--bundled` 또는 `KCA_BUNDLED=1`

## provenance

`kcachat`로 만든 리포트에는 생성 도구에 `kcachat … → kca …`가 기록됩니다.
