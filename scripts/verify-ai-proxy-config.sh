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

required_refs=(
  "GOOGLE_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
)

for ref in "${required_refs[@]}"; do
  if ! search_in_workflow "${ref}"; then
    echo "❌ security-ci workflow missing ${ref} secret/env reference"
    exit 1
  fi
done

echo "✅ ai-proxy config check passed"
