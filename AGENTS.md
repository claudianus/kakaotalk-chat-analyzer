# 에이전트 지침 (필수)

이 저장소는 **npm에 두 패키지**를 올립니다.

| 패키지 | 설명 |
|--------|------|
| `kakaotalk-chat-analyzer` | 본체 CLI (`kca`) |
| `kcachat` | 짧은 `npx` 이름 래퍼(본체 의존) |

## 1. 커밋·푸시 후 npm 배포 (강제)

`main`에 **배포 가치가 있는 변경**(소스·`dist/`·`package.json`·`kcachat/` 등)을 커밋하고 `git push origin main`까지 했다면, **아래를 반드시 이행**할 것. “푸시만 하고 끝”은 허용하지 않는다.

### A. GitHub Actions (기본 경로)

1. 저장소 **Settings → Secrets and variables → Actions**에 **`NPM_TOKEN`**을 등록한다.  
   - npm **Automation** 토큰 또는 **Granular Access Token**(패키지 publish 권한, 필요 시 “bypass 2FA” 허용)을 사용한다.  
   - 일반 `npm login` 세션만으로는 CI에 토큰이 없으므로 **시크릿 등록은 유지보수 담당자가 한 번** 해두면 된다.
2. 푸시가 `.github/workflows/npm-publish.yml`의 `paths`에 걸리면 워크플로가 돌고, **레지스트리 버전보다 `package.json`의 `version`이 새로울 때만** `npm publish`한다.
3. 에이전트는 푸시 직후 **Actions 탭에서 해당 워크플로 성공 여부**를 확인하거나, 사용자에게 확인을 요청한다.

### B. 로컬에서 직접 배포할 때

`NPM_TOKEN`을 쓰지 않고 로컬에서 올릴 경우:

1. `npm whoami`로 로그인 확인. 퍼블리시는 npm 정책상 **2FA 또는 publish 가능한 granular 토큰**이 필요하다.
2. 루트에서: `npm test` 후 `npm publish --access public`
3. 그다음: `cd kcachat && npm install && npm publish --access public`  
   (**본체를 먼저** 올린 뒤 래퍼를 올린다.)

로컬 배포를 했다면 Actions가 중복 퍼블리시하지 않도록 **이미 레지스트리와 같은 `version`이면 워크플로는 스킵**된다.

## 2. 버전 번호 규율

- 레지스트리에 새 tarball을 올리려면 **반드시** 해당 패키지의 `version`을 올린 커밋이 있어야 한다.
- **본체만** 수정: 루트 `package.json`의 `version` 패치/마이너 올림.
- **`kcachat`만** 수정: `kcachat/package.json`의 `version` 올림(README만 고친 경우는 생략 가능).
- **본체 동작이 바뀌면** 래퍼 사용자에게 새 본체가 깔리도록, 필요 시 `kcachat/package.json`의 `dependencies["kakaotalk-chat-analyzer"]` 범위를 조정하고 래퍼 `version`도 올린다.

## 3. 포크·복제 저장소

`npm-publish.yml`은 `github.repository == 'claudianus/kakaotalk-chat-analyzer'`일 때만 퍼블리시한다. 포크에서 돌리려면 해당 조건을 자기 저장소로 바꾸고 자기 `NPM_TOKEN`을 넣는다.

## 4. GitHub Pages

`docs/` 변경은 기존 **Deploy GitHub Pages** 워크플로로 배포된다. npm과 별개이다.
