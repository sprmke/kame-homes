---
title: 'Incident response'
status: active
tags: [operations, incident, runbook, availability]
updated: 2026-09-19
---

# Incident response

Production-readiness doc 30 (Availability & recovery), Phase 30.5. Written from repo-visible
scripts/integrations this session — **not yet exercised against a real incident or a hosted-dev
drill**. Update this doc after the first real use; a runbook that has never been read during an
actual incident is unproven.

## Severity levels

| Severity | Definition                                                                                              | Example                                                             |
| -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **SEV1** | Guest booking flow or host dashboard fully down for all tenants.                                        | Supabase project unreachable; bad deploy breaks every route.        |
| **SEV2** | A core feature broken for all tenants, or any feature broken for one tenant, with a workaround.         | Payment webhook failing silently; one org's booking workflow stuck. |
| **SEV3** | Degraded but functional — a non-critical module down, elevated error rate below user-visible threshold. | Marketing Studio publish failing; Meta inbox degraded.              |
| **SEV4** | Cosmetic or edge-case bug, no urgency.                                                                  | —                                                                   |

## Who is on call

**Not yet defined** — this repo currently has one collaborator (`@sprmke`, confirmed via `gh api /repos/sprmke/kame-homes` this session). Until a second operator exists, on-call is implicitly "whoever is awake." Revisit this section the moment a second person joins — a single-operator posture is itself the availability risk doc 30's edge cases call out ("if one person holds every credential and all the knowledge, that is the real availability risk").

## First response: assess → communicate → mitigate → fix

1. **Assess.** Check `get-health` (doc 27/30.4 — DB connectivity liveness probe), Vercel deployment status, Supabase dashboard status page, and the last few CI/CD runs (`gh run list --workflow=cd-dev.yml`/`cd-prod.yml`) for a bad-deploy correlation.
2. **Communicate.** No status page or watched alert channel exists yet (doc 27/30 both flag this as open — no platform-level Telegram channel, only per-property ones; PostHog alerts not configured, operator-blocked). Until built, communicate manually: a pinned note wherever the team/operators actually look.
3. **Mitigate first, fix second.** Options in order of narrowness:
   - **Maintenance mode** (`platform_settings.maintenanceMode`, toggled via the `platform-settings` edge function, super-admin + step-up gated) — narrower than it sounds: confirmed in doc 24's session to gate 5 new-intake write paths, **not a full app lock**. It stops new bookings/signups, not existing traffic.
   - **Rollback** — `bun run rollback:functions:<dev|prod>` (functions only) or the fuller `cd-rollback.yml` GitHub Actions workflow. See §Bad deploy below.
   - **Kill switch** — does not exist yet as a general mechanism. [`module-status-management.md`](../../workflow/planned/module-status-management.md) (a `live`/`coming_soon`/`maintenance` per-module registry) is the planned mechanism — status `planned`, not built. Until it ships, the only kill switch is maintenance mode (blunt) or a manual env/secret change to disable one integration (e.g., unset a webhook secret to stop processing a specific provider's callbacks).
4. **Fix.** Root-cause once mitigated — do not skip mitigation to "just fix it fast," a rushed fix under a live incident is how a SEV2 becomes a SEV1.
5. **Post-incident review.** Not yet templated — write what happened, why, what the mitigation was, and one concrete process/code change, in a new file under `docs/archive/operations/` per incident once this has been used for real.

## Per-scenario runbooks

| Scenario                               | Runbook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Database down/unresponsive**         | Check Supabase status dashboard first — this is almost never fixable from our side. `get-health` will report `db: unreachable`. Enable maintenance mode to stop new writes. No further action possible until Supabase recovers; this is the top entry in doc 25.6's vendor-risk table ("Supabase — none. The platform.").                                                                                                                                                                            |
| **Bad deploy**                         | `bun run rollback:functions:<dev\|prod>` for a functions-only regression, or trigger `cd-rollback.yml`. Confirm via `bun run migrations:status:<dev\|prod>` that the rollback didn't leave migrations ahead of the restored function set — a functions rollback with no matching schema rollback can reintroduce the exact contract mismatch a migration was fixing.                                                                                                                                 |
| **Bad migration**                      | Full restore procedure (`bun run rollback:supabase:<dev\|prod> -- --fresh-target`) — **this has not been rehearsed against hosted-dev** (doc 30's own "single largest open risk," unchanged this session, still needs a human with hosted-dev access). Read `docs/archive/operations/migration-runbook.md` §6 before running.                                                                                                                                                                        |
| **Payment provider outage (PayMongo)** | No fallback provider in-market (doc 25.6). Existing bookings/subscriptions are unaffected (already paid). New checkout/renewal links fail — communicate to affected hosts, do not attempt a workaround payment path. `platform-billing-cron`'s dunning emails will naturally retry on the next scheduled run once PayMongo recovers.                                                                                                                                                                 |
| **Email provider outage (Resend)**     | Guest confirmations, GAF/pet approval intake (`approval-email-webhook`), and SD refund emails all stop. No fallback provider. Queue is implicit — `WorkflowOrchestrator` transitions still record state even if the notification email throws (verify this is still true per-transition before relying on it during a live incident). Backfill sends manually once Resend recovers by re-triggering the workflow's own resend actions in the admin UI, not by writing a one-off script mid-incident. |
| **AI provider outage (Gemini/Groq)**   | The AI plan's quota/credit/upgrade-hook layer already degrades gracefully — confirm the specific feature (assistant, receipt validation, marketing generation) shows a clear "temporarily unavailable" state rather than a raw 500. Core booking loop is unaffected — no AI dependency in the guest form → workflow → checkout path.                                                                                                                                                                 |
| **Meta API outage**                    | Host inbox's Meta channel goes silent; web chat and every other module unaffected. `metaInboxHealthcheckCron.ts` already exists to detect and attempt re-subscription — check its last run via cron logs once hosted access exists.                                                                                                                                                                                                                                                                  |
| **Storage unavailable**                | Media (property photos, uploaded documents, generated PDFs) breaks. **The booking flow itself must survive this** — verify a guest can still submit a booking with a broken Storage upload (doc 30's edge case: "the booking flow must survive AI, Meta, Telegram, and Marketing being down" implicitly extends to Storage for non-blocking uploads). Not verified end-to-end this session.                                                                                                          |
| **Cost runaway**                       | No `serviceGuard.ts` enforcement layer exists yet (confirmed absent again this session, doc 25). Manual mitigation: check the specific vendor's dashboard for the spend source, then disable the specific feature via env var/secret removal (e.g., unset `RESEND_API_KEY` to hard-stop all email sends, accepting the tradeoff) rather than a graceful per-feature kill switch, since none exists.                                                                                                  |
| **Security incident**                  | Rotate every credential the suspected exposure could reach (`docs/archive/operations/secret-rotation.md`), revoke active sessions if auth-related, preserve evidence (Supabase logs, PostHog exception captures with `requestId` correlation — doc 27) before rotating anything that would destroy it, then notify per the communication gap noted above.                                                                                                                                            |

## Degradation targets (what must keep working)

Per doc 30.6: the app should lose features, not fall over. Confirmed this session (not newly built):

- PWA offline support already provides some guest-side resilience during a backend outage — **what specifically works offline has not been verified end-to-end this session** (doc 30's own open item; see `docs/architecture/pwa.md`).
- Maintenance mode's narrow 5-path scope (doc 24) means existing sessions/reads keep working even with new intake blocked — this is a feature, not a gap, for a partial outage.

## Cron disable/enable during a restore

17 functions run via hosted `pg_cron` + `pg_net` (not `config.toml` schedules): `activity-log-retention-cron`, `analytics-ai-review-cron`, `contract-expiry-cron`, `dashboard-assistant-expire-pending-actions`, `expire-parking-broadcasts`, `marketing-generation-sweeper`, `meta-inbox-webhook-healthcheck`, `platform-billing-cron`, `property-page-views-prune-cron`, `query-cache-sweep-cron`, `send-parking-reminders`, `smart-pricing-cron`, `telegram-admin-cron`, `telegram-finance-cron`, `telegram-maintenance-cron`, `telegram-marketing-cron`, `telegram-staff-cron`.

Before a restore: `UPDATE cron.job SET active = false;` (or per-job `SELECT cron.unschedule('<job_name>');`) — crons resuming immediately after a restore can fire for a "missed window" and re-send duplicate emails/notifications to real guests (doc 30's own edge case). Re-enable individually after verifying the restored data is consistent, not with a single bulk re-enable — a job whose underlying table didn't restore cleanly should stay off until checked.

**Not yet done:** a scripted disable-all/enable-all (currently manual SQL per the above); per-job overlap-safety audit is only 2/6 confirmed (doc 15).

## Single-tenant recovery

Not yet documented or tested — doc 30.7 flags this as the realistic support request ("a host deleted something and wants it back") that is much harder than a full restore, since there's no per-tenant export/restore tooling today. `activity_log` is the forensic record of what changed (who did what), which narrows the "what happened" question but doesn't itself restore anything.
