#!/usr/bin/env bash
# ⚠️ DEPRECATED: Trusted Publishing (OIDC)가 선호됩니다 (npm-publish.yml 참조).
# 이 스크립트는 NPM_TOKEN 방식이 필요할 때만 사용하세요.
#
# GitHub Actions 시크릿 NPM_TOKEN 등록 (값은 출력하지 않음)
# 사용: NPM_TOKEN=npm_xxx... ./scripts/sync-npm-token-to-gh.sh
#   또는 NPM_TOKEN_FILE=./.secrets/npm-token (한 줄, gitignore됨)
set -euo pipefail

echo "⚠️  Trusted Publishing(OIDC)이 선호 방식입니다. npmjs.com → 패키지 → Settings → Trusted Publishers."
echo "이 스크립트는 레거시 NPM_TOKEN 방식입니다. 계속하려면 Enter, 취소는 Ctrl+C."
read -r

REPO="${GITHUB_REPO:-claudianus/kakaotalk-chat-analyzer}"

token_from_npmrc() {
  node -e "
const fs = require('fs');
const path = require('path');
const p = path.join(process.env.HOME || '', '.npmrc');
const s = fs.readFileSync(p, 'utf8');
const m = s.match(/\\/\\/registry\\.npmjs\\.org\\/:_authToken=(\\S+)/i);
if (!m) process.exit(2);
process.stdout.write(m[1].trim());
"
}

if [ -n "${NPM_TOKEN:-}" ]; then
  TOKEN="$NPM_TOKEN"
elif [ -n "${NPM_TOKEN_FILE:-}" ] && [ -f "$NPM_TOKEN_FILE" ]; then
  TOKEN=$(tr -d '[:space:]' < "$NPM_TOKEN_FILE")
else
  TOKEN=$(token_from_npmrc) || true
fi

if [ -z "${TOKEN:-}" ]; then
  echo "토큰을 찾을 수 없습니다. 다음 중 하나를 하세요:"
  echo "  export NPM_TOKEN=npm_...   # npm Automation 또는 Granular(publish)"
  echo "  NPM_TOKEN_FILE=./.secrets/npm-token $0"
  echo "  또는 ~/.npmrc 에 //registry.npmjs.org/:_authToken= 이 있으면 자동 사용"
  echo ""
  echo "💡 권장: Trusted Publishing으로 전환하세요 (npmjs.com → Package → Trusted Publishers)"
  exit 1
fi

if ! command -v gh >/dev/null; then
  echo "gh CLI가 필요합니다: https://cli.github.com/"
  exit 1
fi

gh secret set NPM_TOKEN --repo "$REPO" --body "$TOKEN"
echo "OK: GitHub repo $REPO 에 NPM_TOKEN 시크릿을 설정했습니다."
echo "참고: 새 패키지(kcachat) 퍼블리시는 npm 'Automation' 또는 Granular(publish + 필요 시 bypass 2FA) 토큰이어야 합니다."
echo "💡 Trusted Publishing으로 전환하는 것을 권장합니다."
