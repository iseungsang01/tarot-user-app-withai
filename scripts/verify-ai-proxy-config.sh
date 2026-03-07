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

if ! search_in_workflow "AI_PROXY_REQUIRE_AUTH:[[:space:]]*true"; then
  echo "❌ security-ci workflow must set AI_PROXY_REQUIRE_AUTH=true"
  exit 1
fi

required_refs=(
  "GOOGLE_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

for ref in "${required_refs[@]}"; do
  if ! search_in_workflow "${ref}"; then
    echo "❌ security-ci workflow missing ${ref} secret/env reference"
    exit 1
  fi
done

echo "✅ ai-proxy config check passed"
