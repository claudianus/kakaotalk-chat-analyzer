# kcachat

`kakaotalk-chat-analyzer`를 **짧은 npx 이름**으로 실행하기 위한 초경량 래퍼입니다. 기능·CLI·리포트는 전부 본 패키지에 있습니다.

```bash
npx kcachat@latest "./KakaoTalk_Chat_....csv" --local
npx kcachat@latest "./KakaoTalk_Chat_....csv"
```

### `npx`·버전

- **0.1.4+** `kcachat`는 실행할 때마다 `kakaotalk-chat-analyzer@latest` 본체를 받아 실행합니다(네트워크 필요). 현재 래퍼 **0.1.13** · 본체 **0.3.4** 권장.
- 오프라인·고정 버전만 쓰려면 `--bundled` 또는 환경 변수 `KCA_BUNDLED=1` (설치 시 함께 깔린 본체 사용).
- 설치 확인 문구가 안 뜨는 것은 `~/.npm/_npx` 캐시 때문일 수 있습니다.
- 버전 확인: `npx kcachat@latest --version` → `kcachat` 줄 + registry 최신 본체 버전.

- 전체 패키지명: [kakaotalk-chat-analyzer](https://www.npmjs.com/package/kakaotalk-chat-analyzer)
- 소개·시작 가이드(랜딩): [GitHub Pages](https://claudianus.github.io/kakaotalk-chat-analyzer/)
