# AI platform billing and production keys

Operational guide for shared Gemini/Groq AI features (receipt validation, inbox suggest, marketing captions, import column mapping, and voice receptionist sessions).

## Production model

- **One paid Google AI / Gemini project** per environment (dev Supabase + production Supabase).
- Set a **single** `GEMINI_API_KEY` in Supabase Edge secrets — do not rely on multi-key free-tier rotation in production.
- Optional `GROQ_API_KEY` as **emergency fallback only** (paid Groq when you outgrow free tier).
- Enable **billing** on the Google Cloud project linked to AI Studio and configure a **monthly budget alert** in GCP Billing.

## Local / bootstrap

- `GEMINI_API_KEYS` (comma-separated, different Google projects) remains supported for local dev rate-limit rotation.
- See [`docs/architecture/validation-and-env.md`](../../architecture/validation-and-env.md) for env var names.

## Usage metering (in-app)

Migrations `20261009120000_ai_platform_usage.sql` and `20260814130000_ai_platform_hardening.sql` add:

| Table                              | Purpose                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `ai_platform_global_settings`      | Platform kill switch + `enforce_quotas` + `allowed_features` + default quotas             |
| `ai_platform_org_settings`         | Per-org daily/monthly call + daily USD cost caps (defaults: 200/day, 5000/month, $10/day) |
| `ai_platform_property_settings`    | Per-property enable + optional override caps (NULL = inherit org)                         |
| `ai_platform_property_usage_daily` | Aggregated counters per property per UTC day                                              |
| `ai_platform_usage_daily`          | Aggregated counters per org per UTC day                                                   |
| `ai_platform_usage_events`         | Append-only audit log per AI call                                                         |
| `ai_platform_response_cache`       | Deterministic prompt response cache (1-hour TTL)                                          |

Edge functions:

- `ai-platform-global-settings` — super-admin GET/PATCH (kill switch + feature allowlist + default quotas)
- `ai-platform-settings` — org GET/PATCH limits
- `ai-platform-usage` — org GET summary + per-feature + per-property breakdown
- `ai-platform-property-settings` — per-property GET/PATCH overrides

Shared server modules:

- `supabase/functions/_shared/aiModelRouter.ts` — feature → Gemini model tier
- `supabase/functions/_shared/aiUsageService.ts` — quota checks + `recordAiUsage` + property settings
- `supabase/functions/_shared/aiQuotaCache.ts` — deterministic prompt cache

## Model tiering (defaults)

| Feature                                                                                  | Model                   |
| ---------------------------------------------------------------------------------------- | ----------------------- |
| Receipt validation / marketing templates / booking AI review / dashboard assistant       | `gemini-2.5-flash`      |
| Inbox suggest / auto-reply / marketing captions / import column map / integration verify | `gemini-3.1-flash-lite` |
| Voice Live (provider Preview)                                                            | `gemini-3.8-live`       |

Verify current rates at [ai.google.dev/pricing](https://ai.google.dev/gemini-api/docs/pricing) before budgeting.

## Voice production gate

Voice uses `v1beta` constrained ephemeral tokens. The browser never receives the long-lived Gemini
API key. Before raising rollout above zero, the billing/project owner records evidence for:

- paid Gemini project and billing account
- budget alerts at warning and hard-review thresholds
- API key limited to the Gemini API and server use
- Google data-processing terms accepted for the operating entity
- provider retention and model-improvement settings reviewed for guest audio
- supported processing region reviewed against the product privacy notice
- Live API and ephemeral-token Preview risk accepted for the release
- `gemini-3.8-live` rechecked against Google docs by `2026-10-15`
- `voice-receptionist-canary` green in staging for seven consecutive days
- current Live price reconciled with `voice_receptionist_cost_per_minute_usd`

These are provider-console checks and cannot be inferred from repository configuration. Keep
`voice_receptionist_rollout_percentage = 0` until the evidence is attached to the release record.

## Voice cost reconciliation

`voice_receptionist_sessions` stores measured duration and an estimated cost. One
`ai_platform_usage_events` row is claimed per terminal session, including failed or abandoned
sessions. Monthly, compare provider invoice totals against summed voice usage events, then adjust
the super-admin **Voice cost/min (USD)** value. Do not rewrite historical events.

## Dual-track deploy

- **Multi-tenant dev** (`fwor…`): paid dev Gemini key in dev Supabase secrets.
- **Legacy prod** (`zftt…`): separate paid prod key when live users depend on AI — never share dev keys with prod.
- See [`docs/architecture/deployment.md`](../../architecture/deployment.md).

## Upgrade / billing product

Org settings show a stub **Upgrade** CTA when quotas are exceeded (`upgradeHook: true` on 429 responses). Stripe / paid tiers are future work — caps protect margin until billing ships.
