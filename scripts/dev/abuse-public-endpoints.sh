#!/usr/bin/env bash
# Staging-only abuse checks for cost/abuse hardening (plan §6.1).
# Usage: BASE_URL=https://<ref>.supabase.co/functions/v1 ./scripts/dev/abuse-public-endpoints.sh
set -euo pipefail

BASE_URL="${BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Set BASE_URL to hosted dev functions root (…/functions/v1)." >&2
  exit 1
fi
if [[ "$BASE_URL" == *"zfttdwtceyqszyeyhilc"* ]]; then
  echo "Refusing to run against legacy production project ref." >&2
  exit 1
fi

echo "== A4 get-form random UUID burst (expect some 429 after platform RL) =="
for i in $(seq 1 25); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE_URL}/get-form/00000000-0000-4000-8000-000000000001")
  echo "  $i -> $code"
done

echo "== A6 search-listings burst =="
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "${BASE_URL}/search-listings?q=test")
  echo "  $i -> $code"
done

echo "== A5 get-form without access token (401/404 when GUEST_BOOKING_ACCESS_ENFORCE=true; else 404) =="
code=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/get-form/00000000-0000-4000-8000-000000000002")
echo "  bare uuid -> $code"

echo "== A12 sd-refund-cron without secret (401 when ENVIRONMENT=production + secret unset) =="
code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/sd-refund-cron" \
  -H 'Content-Type: application/json' \
  -d '{}')
echo "  no secret -> $code"

echo "== A13 paymongo webhook bad signature (expect 401, then 429) =="
for i in $(seq 1 35); do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/paymongo-webhook" \
    -H 'Content-Type: application/json' \
    -H 'Paymongo-Signature: t=1,v1=deadbeef' \
    -d '{"data":{"id":"evt_test","attributes":{"type":"event.test"}}}')
  echo "  $i -> $code"
done

echo "Done. Review status codes manually; 429 confirms durable rate limits."
