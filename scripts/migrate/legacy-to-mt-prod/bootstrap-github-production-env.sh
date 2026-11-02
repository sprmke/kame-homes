#!/usr/bin/env bash
# Set non-sensitive + sensitive GitHub Environment secrets for cd-prod (environment: production).
# Reads Management API PAT (sbp_…) from env or supabase/.env.management.local; DB password from supabase/.env.local — never prints values.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

ENV_NAME=production
FWOR=fworvijbrwpyngycotbz
LEGACY=zfttdwtceyqszyeyhilc

gh api --method PUT "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/environments/${ENV_NAME}" \
  -H "Content-Type: application/json" --input - <<< '{}' >/dev/null || true

gh secret set SUPABASE_PROJECT_REF --env "$ENV_NAME" --body "$FWOR"
gh secret set LEGACY_PROD_PROJECT_REF --env "$ENV_NAME" --body "$LEGACY"
gh secret set MULTI_TENANT_DEV_PROJECT_REF --env "$ENV_NAME" --body "$FWOR"

TOKEN="$(bun -e "
import { resolveSupabaseAccessToken } from './scripts/migrate/legacy-to-mt-prod/lib/supabaseManagementToken.mjs';
process.stdout.write(resolveSupabaseAccessToken());
" 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  echo "WARN: no sbp_ Management API token — skip SUPABASE_ACCESS_TOKEN"
  echo "      supabase login is not enough. Create PAT: Dashboard → Account → Access Tokens"
  echo "      Then: cp supabase/.env.management.example supabase/.env.management.local and paste sbp_…"
elif [[ "$TOKEN" != sbp_* ]]; then
  echo "WARN: token is not an sbp_ PAT — skip SUPABASE_ACCESS_TOKEN"
else
  http_code="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${TOKEN}" \
    "https://api.supabase.com/v1/projects/${FWOR}/config/auth")"
  if [[ "$http_code" != "200" ]]; then
    echo "WARN: PAT rejected by Management API (HTTP ${http_code}) — create a fresh sbp_ token"
  else
    gh secret set SUPABASE_ACCESS_TOKEN --env "$ENV_NAME" --body "$TOKEN"
  fi
fi

DBPW="$(grep -E '^TARGET_DB_PASSWORD=' supabase/.env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '[:space:]\"' || true)"
if [[ -z "$DBPW" ]]; then
  echo "WARN: TARGET_DB_PASSWORD missing in supabase/.env.local"
else
  gh secret set SUPABASE_DB_PASSWORD --env "$ENV_NAME" --body "$DBPW"
fi

SCRATCH="$(ls -dt /tmp/kame-homes-vercel-env-* 2>/dev/null | head -1 || true)"
ANON=""
if [[ -n "$SCRATCH" && -f "$SCRATCH/.env.vercel.production" ]]; then
  ANON="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$SCRATCH/.env.vercel.production" | sed 's/^VITE_SUPABASE_ANON_KEY=//' | tr -d '\"')"
fi
if [[ -z "$ANON" ]]; then
  ANON="$(supabase projects api-keys --project-ref "$FWOR" -o json 2>/dev/null | bun -e "
    const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
    const row=j.find(r=>r.name==='anon');
    if(row) process.stdout.write(row.api_key||row.key_value||'');
  " 2>/dev/null || true)"
fi
if [[ -n "$ANON" ]]; then
  gh secret set SUPABASE_ANON_KEY --env "$ENV_NAME" --body "$ANON"
else
  echo "WARN: could not resolve anon key for SUPABASE_ANON_KEY"
fi

if PROD_DB_URL="$(bun "$ROOT/scripts/migrate/legacy-to-mt-prod/resolve-target-db-url.mjs" 2>/dev/null)" && [[ -n "$PROD_DB_URL" ]]; then
  gh secret set PROD_DB_URL --env "$ENV_NAME" --body "$PROD_DB_URL"
else
  echo "WARN: could not resolve PROD_DB_URL (set TARGET_DB_URL or TARGET_DB_PASSWORD in supabase/.env.local)"
fi

echo "bootstrap-github-production-env: done (names only check below)"
gh secret list --env "$ENV_NAME"
