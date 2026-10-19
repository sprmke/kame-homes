# Phase 8.1 Lighthouse — hosted-dev — 2026-10-19

One mobile-throttled run (`--runs=1`) against `https://dev.kamehomes.space`. JSON: `checklist/baselines/2026-10-18-lighthouse-phase8-hosted-dev-2026-10-19.json`.

Not a 3× median. Auth-gated routes measured the **redirect/guard shell** (demo slugs, no session).

| Route                               | Score | LCP ms | CLS       | TBT ms | Transfer |
| ----------------------------------- | ----- | ------ | --------- | ------ | -------- |
| `/`                                 | 57    | 12146  | 0.000     | 26     | 2.5 MiB  |
| `/properties`                       | 60    | 9950   | 0.000     | 51     | 1.1 MiB  |
| `/properties/demo-property/form`    | 57    | 15196  | 0.086     | 62     | 2.0 MiB  |
| `/parkings`                         | 58    | 9677   | 0.000     | 65     | 1.1 MiB  |
| `/account` (anon → sign-in)         | 60    | 6805   | 0.086     | 55     | —        |
| `/org/demo-org/…/bookings` (unauth) | 46    | 9226   | **0.270** | 68     | —        |
| `/org/demo-org/…/finance` (unauth)  | 46    | 9367   | **0.270** | 31     | —        |
| `/for-hosts/pricing`                | 59    | 8291   | 0.000     | 31     | —        |
| `/admin` (unauth)                   | 46    | 10021  | **0.270** | 29     | —        |

Public CLS is fine. LCP is well above a 2.5s budget (throttled + cold). Auth-shell CLS 0.270 exceeds 0.1 (PR-040). Landing payload ~2.5 MiB.
