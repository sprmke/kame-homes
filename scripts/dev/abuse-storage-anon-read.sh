#!/usr/bin/env bash
# A11 — anon must not read private guest-doc storage objects (cost/abuse §6.1).
# Requires Phase 2 migration applied. Pass a known object path from storage audit.
#
# Usage:
#   SUPABASE_URL=https://<ref>.supabase.co \
#   ANON_KEY=... \
#   STORAGE_OBJECT_PATH=valid-ids/<propertyId>/sample.jpg \
#   ./scripts/dev/abuse-storage-anon-read.sh
set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-}"
ANON_KEY="${ANON_KEY:-}"
OBJECT_PATH="${STORAGE_OBJECT_PATH:-}"

if [[ -z "$SUPABASE_URL" || -z "$ANON_KEY" || -z "$OBJECT_PATH" ]]; then
  echo "Set SUPABASE_URL, ANON_KEY, and STORAGE_OBJECT_PATH." >&2
  exit 1
fi
if [[ "$SUPABASE_URL" == *"zfttdwtceyqszyeyhilc"* ]]; then
  echo "Refusing legacy production project ref." >&2
  exit 1
fi

BUCKET="${OBJECT_PATH%%/*}"
KEY="${OBJECT_PATH#*/}"
PUBLIC_URL="${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${KEY}"

echo "== A11 anon GET public URL (expect 400/401/404, not 200 image) =="
code=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  "$PUBLIC_URL")
echo "HTTP $code for $PUBLIC_URL"
if [[ "$code" == "200" ]]; then
  echo "FAIL: anon read succeeded on private bucket" >&2
  exit 1
fi
echo "A11 OK (not publicly readable)."
