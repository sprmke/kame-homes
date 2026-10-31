---
title: 'QA — Plans × Team RBAC matrix'
status: active
updated: 2026-08-29
---

# 16 — Plans & team permissions matrix

## Local seed reality

All local orgs (`kame-home`, `kame-homes`) were **Free** during this pass. Live UI verified Free. Higher tiers verified against `docs/architecture/plans-feature-matrix.md` + gate call sites unless noted.

## Seeded role expectations (property)

| Capability             | Full Access | Operations      | Read Only      |
| ---------------------- | ----------- | --------------- | -------------- |
| Bookings view/workflow | ✅          | ✅              | view only      |
| Finance                | ✅          | ❌              | ❌             |
| Settings / Team manage | ✅          | ❌              | team view only |
| Inbox reply            | ✅          | ✅              | view           |
| Marketing content      | ✅          | ✅              | ❌             |
| Pricing rates/blocks   | ✅          | view + channels | view           |

**Critique:** Operations without finance is safe but may not match “assistant who pays condo dues.” Read Only has `team:view` while Operations does not — flip for consistency.

## Plan feature smoke (property surfaces)

| Feature                                                                                  | Free           | Starter   | Pro | Business  | Property surface           |
| ---------------------------------------------------------------------------------------- | -------------- | --------- | --- | --------- | -------------------------- |
| Core bookings                                                                            | ✅             | ✅        | ✅  | ✅        | Bookings                   |
| `automatedBookingFlow`                                                                   | ❌             | ✅        | ✅  | ✅        | Workflow emails            |
| `bookingImport`                                                                          | preview        | ✅        | ✅  | ✅        | Bookings Import            |
| `telegramNotifications`                                                                  | ❌ enable      | ✅        | ✅  | ✅        | Notifications              |
| `financeReporting` / `maintenanceReporting`                                              | ❌             | ✅        | ✅  | ✅        | Export                     |
| `customTemplates` / `quickReplies` / `customRoles`                                       | ❌             | ✅        | ✅  | ✅        | Templates / Inbox / Team   |
| `marketingStudio`                                                                        | watermark      | watermark | ✅  | ✅        | Marketing                  |
| `publicPagesAutosave` / `propertyShowcase` / `calendarSync`                              | explore / lock | same      | ✅  | ✅        | Public Pages / Pricing     |
| `aiValidations`                                                                          | ❌             | ❌        | ✅  | ✅        | Booking AI                 |
| `metaChatChannel` / `aiChatAutoReply` / `aiDashboardAssistant` / `aiMarketingGeneration` | ❌             | ❌        | ❌  | ✅        | Inbox / FAB / Marketing AI |
| `marketingPublishLimitPerGroup`                                                          | 0              | 0         | —   | unlimited | Publish                    |

## Re-test commands (paid tiers)

```sql
-- LOCAL ONLY
UPDATE org_subscriptions
SET plan_id = '277610f1-739e-4575-9e24-cc8cb8af0373' -- growth/Pro
WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'kame-home');
```

Then walk Pricing Channel Sync (no watermark), Public Pages save, Marketing studio without watermark. Repeat with Business plan id `0ff28a54-…` for Meta + AI assistant send.

## Permission live gap

Second-user invite accept + Operations/Read Only login was **not** completed in this session (needs another Google/OTP identity). Track as follow-up using e2e harness `propertyTeamRbacHarness.ts` if present.
