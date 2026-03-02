#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_FILE=".github/workflows/security-ci.yml"

if ! rg -n "AI_PROXY_REQUIRE_AUTH:\s*true" "$WORKFLOW_FILE" >/dev/null; then
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
  if ! rg -n "${ref}" "$WORKFLOW_FILE" >/dev/null; then
    echo "❌ security-ci workflow missing ${ref} secret/env reference"
    exit 1
  fi
done

echo "✅ ai-proxy config check passed"
