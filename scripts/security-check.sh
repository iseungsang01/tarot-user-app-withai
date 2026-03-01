#!/usr/bin/env bash
set -euo pipefail

# 1) Prevent client-side direct AI secret usage
if rg -n "EXPO_PUBLIC_GOOGLE_API_KEY" src --glob '!src/services/supabase.js'; then
  echo "❌ Client-side AI secret reference detected"
  exit 1
fi

# 2) Ensure deprecated hook files do not return
if [ -f src/hooks/useOpenAI.js ] || [ -f src/services/openaiService.js ]; then
  echo "❌ Deprecated OpenAI files detected"
  exit 1
fi

echo "✅ security-check passed"
