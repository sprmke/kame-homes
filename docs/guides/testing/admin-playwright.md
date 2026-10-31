---
title: 'Admin Playwright'
status: active
tags: [guides, testing, playwright, admin]
updated: 2026-09-11
---

# Admin Playwright

Mocked E2E for super-admin shell routes. **No OTP step-up or real approve/reject in CI.**

## Specs

| Spec                                                | Tags  | Covers                                                |
| --------------------------------------------------- | ----- | ----------------------------------------------------- |
| `ui/e2e/features/admin/adminShellSmoke.spec.ts`     | `@ci` | `/admin` overview; non-super-admin access restricted  |
| `ui/e2e/features/admin/adminApprovalsSmoke.spec.ts` | `@ci` | `/admin/approvals` queue toolbar + mocked pending row |

## Harness

| File                                                    | Role                                              |
| ------------------------------------------------------- | ------------------------------------------------- |
| `ui/e2e/features/admin/shared/adminApprovalsHarness.ts` | Mocks `list-super-admin-approvals` list + summary |

Super-admin specs mock `list-organizations.isSuperAdmin` for `host@example.com`; no email allow list is bundled into the test UI.

## Run

```bash
bun x playwright test ui/e2e/features/admin --project=chromium-ci
```

## Manual gaps

OTP step-up, document review dialogs, and payout flows stay manual. See [`super-admin-manual.md`](./super-admin-manual.md).
