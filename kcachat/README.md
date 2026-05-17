# kcachat

`kakaotalk-chat-analyzer`를 **짧은 npx 이름**으로 실행하기 위한 초경량 래퍼입니다. 기능·CLI·리포트는 전부 본 패키지에 있습니다.

```bash
npx kcachat@latest "./KakaoTalk_Chat_....csv" --local
npx kcachat@latest "./KakaoTalk_Chat_....csv"
```

### `npx`·버전

- **0.1.4+** `kcachat`는 실행할 때마다 `kakaotalk-chat-analyzer@latest` 본체를 받아 실행합니다(네트워크 필요).
- 버전 확인: `npx kcachat@latest --version` → **kcachat** 줄 + registry **본체** 버전.
- 오프라인·고정 버전: `--bundled` 또는 `KCA_BUNDLED=1` (설치 시 함께 깔린 본체).
- `npx` 캐시 때문에 예전 본체가 보이면 `npx --yes kakaotalk-chat-analyzer@latest --version`으로 본체 버전을 직접 확인하세요.

### provenance

`kcachat`로 생성한 리포트 HTML에는 `KCA_INVOKER=kcachat/<래퍼버전>`이 기록되어, 사이드 카드 **생성 도구**에 `kcachat … → kca …`로 표시됩니다.

- 전체 패키지명: [kakaotalk-chat-analyzer](https://www.npmjs.com/package/kakaotalk-chat-analyzer)
- 소개·시작 가이드(랜딩): [GitHub Pages](https://claudianus.github.io/kakaotalk-chat-analyzer/)
