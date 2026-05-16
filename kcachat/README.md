# kcachat

`kakaotalk-chat-analyzer`를 **짧은 npx 이름**으로 실행하기 위한 초경량 래퍼입니다. 기능·CLI·리포트는 전부 본 패키지에 있습니다.

```bash
npx kcachat@latest "./KakaoTalk_Chat_....csv" --local
npx kcachat@latest "./KakaoTalk_Chat_....csv"
```

### `npx`가 예전 버전처럼 보일 때

- **설치 확인 문구가 안 뜨는 것**은 대부분 정상입니다. 한 번 받아 둔 패키지는 `~/.npm/_npx`에 캐시되어 **다음부터는 바로 실행**합니다.
- `kcachat@latest`는 **래퍼 패키지** 최신(예: `0.1.2`)만 가리킵니다. 본체(`kakaotalk-chat-analyzer`)는 래퍼가 설치될 때 함께 깔리며, **그때의 캐시 폴더에 고정**될 수 있습니다.
- 최신 본체를 강제로 받으려면:
  ```bash
  npx --yes --prefer-online kcachat@latest --version
  npx --yes --prefer-online kakaotalk-chat-analyzer@latest "./파일.csv" --local
  ```
- 설치된 버전 확인: `npx kcachat@latest --version` → `kcachat` / `kakaotalk-chat-analyzer` 두 줄이 출력됩니다.

- 전체 패키지명: [kakaotalk-chat-analyzer](https://www.npmjs.com/package/kakaotalk-chat-analyzer)
- 소개·시작 가이드(랜딩): [GitHub Pages](https://claudianus.github.io/kakaotalk-chat-analyzer/)
