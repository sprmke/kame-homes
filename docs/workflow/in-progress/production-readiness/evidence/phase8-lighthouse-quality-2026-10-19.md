# Phase 8 Lighthouse accessibility / best-practices / SEO — 2026-10-19

Desktop, no throttling, `https://dev.kamehomes.space`, one run per route. Performance is in `phase8-lighthouse-hosted-dev-2026-10-19.md`.

| Route                | A11y | Best practices | SEO |
| -------------------- | ---- | -------------- | --- |
| `/`                  | 96   | 92             | 100 |
| `/properties`        | 96   | 92             | 100 |
| `/parkings`          | 96   | 92             | 100 |
| `/developments`      | 96   | 92             | 100 |
| `/services`          | 94   | 92             | 91  |
| `/search`            | 96   | 92             | 69  |
| `/for-hosts`         | 95   | 92             | 91  |
| `/for-hosts/pricing` | 95   | 92             | 91  |
| `/for-hosts/login`   | 96   | 92             | 91  |
| `/for-guests/login`  | 96   | 92             | 91  |
| `/about`             | 95   | 92             | 91  |
| `/contact`           | 94   | 92             | 91  |
| `/support`           | 95   | 92             | 91  |
| `/privacy`           | 94   | 92             | 91  |
| `/terms`             | 94   | 92             | 91  |

## Failing audits (deduped)

| Audit                                | Pages                                                                                  | Cause                                                                                                                                                                                                                                                                                                                                                             | Status                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| color-contrast                       | all 15                                                                                 | PWA **Install** button (`InstallPrompt.tsx`): white 12px text on brand teal. Teal `--primary` 45% L dark / 40% L light vs white is ~2.4:1 (AA needs 4.5:1). Same ratio applies to every white-on-teal CTA; Lighthouse only measured this one. Also `/for-hosts/login` brand panel white text, `/for-hosts/pricing` plan badges, `/properties` active filter pill. | 🧭 brand color decision (PR-113)                               |
| errors-in-console + inspector-issues | all 15                                                                                 | `upgrade-insecure-requests` inside CSP **Report-Only** is ignored and logs an error                                                                                                                                                                                                                                                                               | Fixed in [#147](https://github.com/sprmke/kame-homes/pull/147) |
| heading-order                        | 8 (pages without a sub-h3 above the footer)                                            | Footer section titles were `h4`                                                                                                                                                                                                                                                                                                                                   | Fixed in #147 (`h2`, same look)                                |
| meta-description                     | 10: services, for-hosts, pricing, both logins, about, contact, support, privacy, terms | Pages do not call `usePageMeta` with a description                                                                                                                                                                                                                                                                                                                | 🔴 PR-114                                                      |
| is-crawlable                         | `/search`                                                                              | `robots.txt` disallows `/search` on purpose                                                                                                                                                                                                                                                                                                                       | ⏸️ intended                                                    |
| valid-source-maps                    | all                                                                                    | Source maps not public by design (PostHog upload)                                                                                                                                                                                                                                                                                                                 | ⏸️ intended; caps Best practices at 92                         |
