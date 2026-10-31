#!/usr/bin/env bash
# Live Gemini smoke for assistant attachment parity (manual guide §11–13 API path).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export LIVE_ASSISTANT_GEMINI=1

ENV_LOCAL="$ROOT/supabase/.env.local"
if [[ -f "$ENV_LOCAL" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^GEMINI_API_KEY= ]] && export "$line"
    [[ "$line" =~ ^GEMINI_API_KEYS= ]] && export "$line"
    [[ "$line" =~ ^JWT_SECRET= ]] && export "$line"
  done < <(grep -E '^(GEMINI_API_KEY(S)?|JWT_SECRET)=' "$ENV_LOCAL" || true)
fi

command -v deno >/dev/null || export PATH="$HOME/.deno/bin:$PATH"
deno test --no-check --allow-env --allow-net \
  supabase/functions/tests/assistantParityLiveGemini.integration_test.ts
