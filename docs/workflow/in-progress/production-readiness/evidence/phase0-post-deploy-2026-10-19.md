# Phase 0.5 local hosted-dev deploy — complete

- Script: `echo dev | ./scripts/deploy/deploy-supabase-dev.sh` from `/tmp/kh-deploy` at `3e269a98` (PR #145).
- Project: `fworvijbrwpyngycotbz`.
- Exit 0. Log: `/tmp/kh-deploy-dev.log` ends with `Deployed Functions.` + `Dev deploy complete`.
- Duration ~27 min. Backup taken first.

This is **not** yet CD from `develop` (PRs #145/#146/#147 still need review). Function SHA for live probes: `3e269a98`. UI remains Vercel `dev.kamehomes.space`.

## Immediate smoke

| Check                           | Result                                     |
| ------------------------------- | ------------------------------------------ |
| `get-health`                    | 200 `db: ok`                               |
| `super-admin-overview` no JWT   | **401** (was 404 mid-deploy)               |
| `list-public-properties`        | 200 `total: 0`                             |
| `voice-receptionist-canary` GET | 400 method not allowed (function exists)   |
| `verify:deployed-preview`       | OK                                         |
| Adversarial auth                | 16/16 (earlier this session, same project) |
