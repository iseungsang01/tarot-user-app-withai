#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_FILE=".github/workflows/security-ci.yml"

search_in_workflow() {
  local pattern="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -n "$pattern" "$WORKFLOW_FILE" >/dev/null
  else
    grep -nE "$pattern" "$WORKFLOW_FILE" >/dev/null
  fi
}

# 인증을 끄는 토글은 제거됐다. 다시 생기면 막는다.
if grep -q "AI_PROXY_REQUIRE_AUTH" supabase/functions/ai-proxy/index.ts "$WORKFLOW_FILE"; then
  echo "❌ ai-proxy must not have an auth bypass toggle (AI_PROXY_REQUIRE_AUTH)"
  exit 1
fi

# CI 는 서버 시크릿을 받지 않는다. 쓰는 단계가 없는데 잡 env 로 두면 npm ci 의
# 설치 스크립트가 읽을 수 있다. 다시 생기면 막는다.
if search_in_workflow 'secrets\.(GOOGLE_API_KEY|SUPABASE_SERVICE_ROLE_KEY)'; then
  echo "❌ security-ci workflow must not receive GOOGLE_API_KEY / SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

echo "✅ ai-proxy config check passed"
