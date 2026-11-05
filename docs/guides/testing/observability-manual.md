---
title: Observability manual drill
status: active
tags: [testing, observability, sentry, posthog, manual]
updated: 2026-11-03
---

# Observability manual drill

Deliberate errors, because most of this cannot be asserted in CI: a real envelope has to
leave a real browser and a real isolate, and a real alert has to arrive.

Run after any change to capture, releases or alerts. Record date, release and result.

**Preconditions**

- One Supabase project serves production, so treat every step as a production action.
- Sentry projects `kame-space-web` and `kame-space-edge` exist; DSNs are set for the
  environment under test.
- PostHog Live events open in the matching project.

## Steps

| #   | Action                                                 | Expect in Sentry                                                                                                       | Expect in PostHog                              |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `/admin/health` → **Send test error**                  | New event, fingerprint `sentry_test`, `fn = super-admin-sentry-test`, release + environment + user id, alert delivered | **Nothing**                                    |
| 2   | DevTools console: `Promise.reject(new Error('drill'))` | Issue, `mechanism.handled = false`                                                                                     | Nothing                                        |
| 3   | DevTools: force a 500 on `functions/v1/list-bookings`  | Issue tagged `fn`, `request_id`, `http_status`                                                                         | Nothing                                        |
| 4   | Submit the guest form with an invalid captcha          | Nothing                                                                                                                | `public_write_blocked` with `scope` + `reason` |
| 5   | Submit a valid guest form                              | Nothing                                                                                                                | `guest_form_submitted` with `app_release`      |
| 6   | Pause one cron for an interval                         | Missed check-in alert (`sd-refund-cron` only)                                                                          | Nothing                                        |
| 7   | Push-notification click while the app is closed        | Any SW error tagged `runtime: service_worker`                                                                          | `notification_opened`                          |
| 8   | Open a guest link with `?access=…`                     | Event URLs contain no `access` value                                                                                   | `$current_url` contains no `access` value      |
| 9   | Stack trace of step 1                                  | Readable TypeScript file and line (source maps)                                                                        | n/a                                            |

## If a step fails

| Symptom                                     | First thing to check                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| Nothing in Sentry at all                    | The DSN for that environment is unset — capture fails silent on purpose      |
| Event has no release                        | `APP_RELEASE` (edge) or `VITE_APP_VERSION` (web) missing from the deploy     |
| Event says `environment: local` on a server | `ENVIRONMENT` is not `production`/`preview`; the resolver falls back locally |
| PostHog shows `$exception`                  | The guards regressed — run `bun run check:posthog-analytics-only`            |
| Minified stack                              | Source map upload failed; the build warns but continues by design            |
| Token visible in a URL                      | The scrub list missed a key — add it to both scrub modules in one change     |

## After the drill

Delete or resolve the `sentry_test` issue with the note "fire drill", and record the run in
the observability plan folder.
