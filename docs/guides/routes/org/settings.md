---
title: 'Organization Settings — operator guide'
status: active
tags: [guides, routes, org, settings]
updated: 2026-09-10
---

# Organization Settings — operator guide

Route: `/org/:orgSlug/settings`

> **Status:** Documented

## Progress overview

| Section                | E2E save  | Validation   | Docs | Notes                                                                                                            |
| ---------------------- | --------- | ------------ | ---- | ---------------------------------------------------------------------------------------------------------------- |
| Basic information      | Yes       | Yes          | Done | Logo, name, slug, brand color, tagline, description, contact info                                                |
| Socials                | Yes       | Yes          | Done | Social URLs (at least one required)                                                                              |
| Trust                  | Read-only | Server       | Done | Earned Superhost badge progress (four criteria, next assessment) — no save path                                  |
| AI platform            | Yes       | Server       | Done | Per-org usage quotas and enabled features; read-only when platform AI off                                        |
| AI dashboard assistant | Yes       | Server       | Done | Opt-in + quotas; chat starters, file attach, per-page pin + Search all modules, canvas Open/Back, history delete |
| Activity               | Read-only | n/a          | Done | Summary row + **Manage** → modal with full org activity feed (`ActivityLogPanel`)                                |
| Danger zone            | Partial   | Slug confirm | Done | Delete when no bookings; finance/maintenance can block; see § Danger zone                                        |

---

## Overview

**Browser tab title:** `${Org Name} - Settings` (org-scoped); fallback `Kame Homes` while loading.

Organization settings uses `AdminSectionNavLayout` with **two save paths**. The desktop **Unsaved changes** footer stays in the main content column (aligned to `max-w-4xl`) so the secondary section nav stays fully usable. Field helpers use a **?** beside the label (`FieldLabel` / `OrgSettingsField` `help`) — not muted text under the control.

1. **Profile** (`organizations` + `organizations.settings` JSONB) → `update-organization` (`org.settings.basic:edit`)
2. **Operator** (`org_settings` row) → `org-settings` — social links + team logo only (email automations live on each property); PATCH requires `org.settings.socials:edit`

Logo upload is immediate via `upload-org-settings-asset` (`team_logo` → `org_settings.email_logo_url` + `organizations.logo_url`) and requires **`org.settings.basic:edit`**.

**Email routing, SD cron tuning, parking defaults, and automation toggles** are **per property** in **`app_settings`** — see **[[guides/routes/org/property/settings|Property Settings — operator guide]]** § Email automations.

**AI platform quotas** are set per organization and inherited by all properties unless overridden per property — see § AI platform.

### Permissions

| Section / action         | Permission                      |
| ------------------------ | ------------------------------- |
| Open Settings            | `org.settings:view`             |
| Basic information + logo | `org.settings.basic:edit`       |
| Socials                  | `org.settings.socials:edit`     |
| AI usage (platform)      | `org.settings.aiPlatform:edit`  |
| AI assistant             | `org.settings.aiAssistant:edit` |
| Danger zone (delete org) | Owner / platform admin only     |

UI locks sections without the matching edit leaf (`org-access` exposes `canEditBasicSettings` / `canEditSocials` / `canEditAiPlatform` / `canEditAiAssistant`). Save chrome only appears for dirty sections the user can edit. Danger zone is hidden unless the user is the org owner or a platform admin.

---

## Host-facing knowledge

Organization settings control your brand identity and public presence: logo, name, tagline, description, brand color, and social links that appear on your host page and guest-facing surfaces. Guest contact details for templates are managed on the **Team** page, not here. Email automations, payment defaults, and booking-specific options live on each **property’s** settings instead.

**Common host questions**

- Q: Where do I set the email address guests see on booking messages?
  A: That's set in per-property settings and team contact info, not on this org profile page. Update the property’s operator settings or the owner’s contact row on **Org team**.
- Q: What happens if I delete the organization?
  A: Deletion is permanent and only allowed when there is no booking history (and no blocking finance or maintenance records). You must type the organization slug to confirm. Your Google sign-in account stays; only this org and its properties are removed.
- Q: Does changing brand color affect every property?
  A: Org brand color tints organization-level admin pages and can serve as a fallback. Each property can still set its own color for guest pages and property admin. Buttons and selected nav use the exact color you pick; gradient buttons are a slight sheen of that same color.
- Q: Why does my logo look cropped in settings?
  A: The logo preview is a square, same as guest forms and your public host page. Upload a square image so nothing important sits at the edges.
- Q: Do I need a logo?
  A: Upload one under Basic information for guest forms, emails, and your public host page. Until you do, the dashboard shows initials from your organization name on a brand-colored tile. After upload you can only replace the logo — not remove it.
- Q: Why do I only see a solid color square for my logo?
  A: That usually means a broken or tiny placeholder file was saved. Replace it with a real square image (tiny 1×1 files are rejected on upload).
- Q: What can I ask the AI assistant?
  A: Open the sparkles button on any dashboard page. A new chat has a Questions / Actions switcher with five starters on each side (stays, money, parking, inbox, marketing, and more). Ask about a pinned booking’s next steps, remaining stages, security deposit refund, or this month’s booked dates — answers should name the guest and dates, not show empty tables or raw status codes. Ask to see an approved GAF, receipt, or ID and the chat should show the file (same files as the booking’s Files tab). Suggested chips under a reply fill the message box so you can edit before sending. Actions can move a booking forward, re-check receipts, or cancel a booking, though risky changes still ask you to confirm first.
- Q: Can I attach a receipt or GAF in the assistant?
  A: Yes. Use the paperclip next to the message box for a photo or PDF (up to three files, 4 MB each). The bookmark icon opens a **module list** (Bookings, Finance, Team, …) — pick a module, then pick the item to pin. The current page’s module is labeled **This page** at the top. **Search all modules…** at the bottom (or **Cmd/Ctrl+K**) opens the same two-step flow in a centered dialog. You can pin several items (up to eight). The message box grows as you type (up to about ten lines).
- Q: What happens when I tap Open on a long table or booking journey?
  A: On a laptop the chat stays on the right and the table or steps open beside it. On a phone the steps fill the panel; Back returns to the chat. Confirming a step still moves only that one status, same as Confirm in the thread.
- Q: Can I delete an old assistant chat?
  A: Yes. Open History (clock), then the trash on that conversation. That chat is gone for good.

---

## Sections

### Basic information

| Field             | Storage                                                 | Validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization logo | `org_settings.email_logo_url`, `organizations.logo_url` | **Required** for settings completion. JPEG/PNG/WebP via `upload-org-settings-asset` (immediate; min **8×8** px — rejects 1×1 placeholders). Preview is a square (`object-cover`). Missing logos show **initials** from the org name on the brand color in the dashboard (sidebar + settings). Platform default logo does not count. Clear/delete is blocked (UI + `org-settings` PATCH) — after upload, hosts can only **replace**. Guest emails use the uploaded logo (or platform default until first upload). |
| Organization name | `organizations.name`                                    | 2–120 chars; globally unique (case-insensitive); **reserved names blocked** (see [onboarding.md](../onboarding.md) § Reserved organization / property names)                                                                                                                                                                                                                                                                                                                                                     |
| URL slug          | `organizations.slug`                                    | Read-only preview; re-allocated on name change                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Brand color       | `organizations.settings.brandColor`                     | Optional hex `#RRGGBB`; defaults to `#24a88e` when unset. Tints **org-scoped admin pages** only (org hub redirect, org dashboard, org settings, org properties) using that hex as `--primary`. Property guest pages and property admin use per-property `app_settings.brand_color` (falls back here when unset). Where it applies is a **?** tooltip on the label (`FieldLabel`).                                                                                                                                |
| Tagline           | `organizations.settings.tagline`                        | Max 60 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Description       | `organizations.description`                             | Max 500 chars + counter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Guest/operator **contact name, phone, and email** for templates and public surfaces are edited on **Org team** (`/org/:orgSlug/team` → **Contact** on the owner row) and **Property team** (member with `team:manage`). Legacy `organizations.settings.contact*` keys remain as read fallback only — not edited on this page.

**Public host page (`/hosts/:orgSlug`):** Owner name and photo come from the **team owner** — OAuth profile (`auth.users` metadata) plus optional **display name** from **Org team** (`organization_members.display_name`). Tagline and description come from **Basic information** above. **Brand color** (`organizations.settings.brandColor`) tints the guest shell and hero accents. **Socials** below render as outbound icon links when URLs are set in **Socials**.

### Socials

| Field         | Storage                             | Notes                                                                                            |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Airbnb        | `org_settings.airbnb_url`           | Optional; DB value wins over `AIRBNB_URL` env                                                    |
| Facebook page | `org_settings.facebook_reviews_url` | Optional; DB value wins over `FACEBOOK_REVIEWS_URL` env; env used only when column is null/empty |
| Instagram     | `org_settings.instagram_url`        | Optional; DB value wins over `INSTAGRAM_URL` env                                                 |
| TikTok        | `org_settings.tiktok_url`           | Optional; DB value wins over `TIKTOK_URL` env                                                    |

**Validation:** at least one social URL.

Properties inherit org social URLs when their `app_settings` columns are empty — see **property settings** § Socials.

Mobile field chrome matches property Socials: `settings-field-label` + `h-9` inputs (`OrgSocialsSection`).

### Trust (Superhost)

Read-only progress for the **earned** Superhost badge (org-wide; all properties inherit). No save path on this page.

| Surface          | API / storage                                  | Notes                                                                                                                      |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Earned badge     | `organizations.settings.superhost.earned`      | Set by quarterly **`superhost-assessment-cron`** (or super-admin **`reassess-org-superhost`**) when all four criteria pass |
| Live progress    | `GET get-org-superhost-progress`               | Rolling **365 days**, org-wide metrics; hook `useOrgSuperhostProgress.ts`                                                  |
| Response rate    | `inbox_thread_metrics`                         | Upserted on first guest inbound + first host reply per inbox thread                                                        |
| Rating           | `guest_reviews.star_rating`                    | Kame reviews only (≥ 3 reviews, avg ≥ 4.8)                                                                                 |
| Cancellations    | `guest_submissions` `CANCELLED` vs `COMPLETED` | Host cancel rate **< 1%**, min 10 bookings in window                                                                       |
| Activity         | `guest_submissions` `COMPLETED`                | ≥ 10 completed stays **or** ≥ 3 stays totaling ≥ 100 nights                                                                |
| Assessment dates | `settings.superhost.nextAssessmentAt`          | Jan 1, Apr 1, Jul 1, Oct 1 (Asia/Manila)                                                                                   |

Public listings read **`isSuperhost`** from org earned flag via `_shared/orgSuperhost.ts` (`get-public-property`, search cards, showcase). There is **no** Airbnb proof import or super-admin Superhost moderation queue.

**Host-facing:** Superhost is earned automatically from performance — reply to inbox messages within 24h, keep cancellations low, collect strong guest reviews, and complete stays on Kame. Progress and next assessment date appear in **Trust** on this page.

**App origin** (email links, default GCash QR base URL) is **not** per-org — set deployment env **`PUBLIC_GUEST_APP_ORIGIN`**. Legacy `org_settings.public_guest_app_origin` is used only when the env var is unset.

### AI platform

| Field                | Storage                                         | Notes                                                                                     |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Platform AI enabled  | `ai_platform_global_settings.enabled`           | Read-only; controlled by super-admin. Section is disabled when false.                     |
| Allowed features     | `ai_platform_global_settings.allowed_features`  | Read-only; controlled by super-admin.                                                     |
| Daily call limit     | `ai_platform_org_settings.daily_call_limit`     | Default 200; blank falls back to platform default.                                        |
| Monthly call limit   | `ai_platform_org_settings.monthly_call_limit`   | Default 5000; blank falls back to platform default.                                       |
| Daily cost USD limit | `ai_platform_org_settings.daily_cost_usd_limit` | Default 10; blank falls back to platform default.                                         |
| Voice receptionist   | inherited from platform allowlist               | Can be enabled per property only when the platform allows the voice receptionist feature. |

Save path: section-local **Save** button → `PATCH ai-platform-settings` (org owner / org admin only). Hook: `useAiPlatformSettings.ts`.

Usage summary: `GET ai-platform-usage` (today, this month, per-feature breakdown, per-property breakdown, **`monthCreditsConsumed`**/**`monthlyCreditLimit`**, **`walletBalanceCredits`**). The section shows **Credits used this month** as a progress bar against the monthly credit allowance, with the top-up wallet balance shown once non-zero. Credit-based enforcement is **live** (org daily/monthly, inherited by properties unless overridden) — once exceeded, calls draw from the org's credit wallet if it has a positive balance, else fail with the same upgrade-hook toast as call/cost limits. The default daily/monthly credit limits ship deliberately generous (not real pricing numbers — see the linked plan doc) so this gate is inert under today's usage until pricing is confirmed; there is no org-editable UI for these limits yet, only super-admin defaults + manual wallet top-ups. Hook: `useAiPlatformSettings.ts`.

### AI dashboard assistant

Independent of **AI platform** (receipt validation, marketing, inbox). Off by default per org; also gated by a super-admin kill switch.

| Field                    | Storage                                                     | Notes                                                   |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| Assistant enabled        | `ai_dashboard_assistant_org_settings.enabled`               | Org owner/admin; hidden on `/admin/*` regardless        |
| Disable on properties    | `ai_dashboard_assistant_org_settings.disabled_property_ids` | Per-property opt-out                                    |
| Daily / monthly messages | `…daily_message_limit`, `…monthly_message_limit`            | Hitting the cap shows an upgrade line in the chat panel |
| Daily write-action limit | `…daily_write_action_limit`                                 | Counts confirmed/auto-executed writes                   |

Save path: section-local **Save assistant settings** → `PATCH dashboard-assistant-settings` (`org.settings.aiAssistant:edit`). Hook: `useAiDashboardAssistantSettings.ts`.

When **Assistant enabled** is on, the section also shows read-only usage for this month: messages, write actions, and **credits consumed** (from `ai_dashboard_assistant_usage_daily.credits_consumed`, reconciled with platform AI metering). Opt-in via `GET dashboard-assistant-settings?includeUsage=true`.

**Chat panel** (not this page): floating sparkles button → slide-over (`sm:max-w-xl` chat-only; wider when canvas is open). Empty chat centers a **Questions / Actions** mode switch (5 randomized prompt cards from `assistantSuggestions.ts`). Tap sends the prompt. While the assistant is working, a left-aligned message bubble with sparkles and bouncing dots appears in the thread (not a floating “Thinking…” line). Composer text is full-width and left-aligned; it grows up to 10 lines, then scrolls. Attach, context pin, and send sit on a row under the text. Paperclip (JPEG/PNG/WebP/PDF, max 3 × 4 MB) + **context pin hub** (`ChatComposerContextHub` — bookmark icon opens module list, drill into items, **Back** returns to modules; current-page module labeled **This page**; max 8 chips) + **Search all modules…** / **Cmd/Ctrl+K** command palette (`ChatContextCommandPalette`, same two-step drill-down) + **mic (speech-to-text**, Chrome/Safari/Edge on HTTPS — tap to start/stop, appends to existing text, stops on send) + send. Pins travel as `attachedContext[]` and do not overwrite the current page's `pageContext`. Asking for a booking file (approved GAF, receipt, ID) shows a preview card from the Files tab, not only a status summary. A booking journey or a table with more than 8 rows shows **Open** → `ChatCanvasOverlay` (split at `lg` / replace below). Suggested chips fill the composer. History (clock) lists your chats grouped by day, with search, wrapping titles, and delete (confirm).

### Activity

Read-only. Summary: "Who did what across your organization." **Manage** opens a large modal (`ActivitySettingsSection` → `ActivityLogPanel`) with the full org-wide activity feed: search, destructive filter, category/date filters, infinite scroll, detail sheet, and CSV export (owner / org-admin, `activityLogExport` plan gate). Legacy `/org/:orgSlug/activity` redirects here with `?open=activity` so the modal opens automatically. See [activity.md](./activity.md). No save path.

### Danger zone — delete organization

**Route UI:** Danger zone section → confirm dialog → type org **slug** → `delete-organization`.

**E2E status:** Works for orgs with **no booking history** and **no property-scoped finance or maintenance rows** (see blockers below). Owner-only (`verifyOrgOwner`). On success, UI navigates to `/org` and invalidates org/property lists.

#### Process (in order)

1. **Client** — Operator types the org slug exactly; `OrgDangerZoneSection` enables delete only on match.
2. **`delete-organization`** (DELETE, body `{ orgId }`) — Authenticated user must own the org (or platform admin).
3. **Pre-check** — Counts `guest_submissions` for all properties in the org. If **any** row exists → **409** (delete aborted; nothing removed).
4. **Storage cleanup (best-effort)** — For each property, removes objects in bucket **`property-media`** whose paths are listed in `properties.settings.media` (gallery uploads only). Failures are logged; delete still proceeds.
5. **DB delete** — `DELETE FROM organizations WHERE id = …` (service role). Postgres cascades to dependent rows (see below). If a **RESTRICT** FK still references a property → **409** _“Organization is still referenced by other records…”_.

#### What gets deleted (when delete succeeds)

| Layer                        | Removed                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organization**             | `organizations` row (name, slug, description, `logo_url`, `settings` JSONB — tagline, brand color, contact fields)                                |
| **Org operator config**      | `org_settings` row (email routing, automations, social URLs, team logo URL column)                                                                |
| **Properties**               | All `properties` rows for the org (name, slug, tower/unit, `settings` JSONB including media metadata)                                             |
| **Property operator config** | `app_settings` per property (payment provider, GCash fields, GAF defaults, integration IDs)                                                       |
| **Telegram**                 | `telegram_admin_settings`, `telegram_finance_settings`, `telegram_maintenance_settings`, `telegram_marketing_settings`, `telegram_staff_settings` |
| **Storage (explicit)**       | **`property-media`** objects referenced in each property’s `settings.media`                                                                       |

All of the above are removed via **ON DELETE CASCADE** from `organizations` → `properties`, except guest/finance/maintenance blockers below.

#### What is **not** deleted (blockers or gaps)

| Item                             | Behavior                                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bookings**                     | **Blocks delete.** Any `guest_submissions` row on any org property → **409** before delete runs. Bookings are **never** bulk-deleted by this action.                                                            |
| **Finance ledger**               | **Can block delete.** `finance_line_items` uses **ON DELETE RESTRICT** on `property_id`. Rows with no bookings but existing finance lines → delete fails with **409** (not pre-checked in edge function today). |
| **Maintenance items**            | **Can block delete.** `maintenance_items` uses **ON DELETE RESTRICT**. Same **409** behavior as finance.                                                                                                        |
| **Org team logo files**          | **Not removed.** Files under `app-settings-assets` / `team-logo/org/{orgId}/…` may remain as orphans.                                                                                                           |
| **Property app-settings assets** | **Not removed.** GCash QR, GAF signature uploads in `app-settings-assets` may remain as orphans.                                                                                                                |
| **Booking uploads**              | N/A when delete succeeds (no bookings). Bucket **`booking-assets`** is untouched by this function.                                                                                                              |
| **External email**               | Sent mail is not recalled; Resend/platform config is env-scoped, not org-scoped.                                                                                                                                |
| **Telegram / inbound logs**      | `processed_emails`, `telegram_*_notification_log`, `finance_telegram_reminder_log`, etc. are **not** org-scoped; rows tied to deleted bookings/properties may remain as orphans.                                |
| **Auth account**                 | **Kept.** `auth.users` (owner) and other organizations owned by the same user are unchanged.                                                                                                                    |
| **Deployment env**               | **Kept.** `PUBLIC_GUEST_APP_ORIGIN`, `FACEBOOK_REVIEWS_URL`, Gmail OAuth app, Resend, Gemini/Groq keys, etc.                                                                                                    |

#### API

|              |                                                                                         |
| ------------ | --------------------------------------------------------------------------------------- |
| **Endpoint** | `DELETE /functions/v1/delete-organization`                                              |
| **Body**     | `{ "orgId": "<uuid>" }`                                                                 |
| **Success**  | `{ deletedOrganizationId }`                                                             |
| **Errors**   | **409** booking history; **409** other FK references; **403/404** not owner / not found |

#### Implementation map

| Concern       | Path                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI            | `ui/src/features/dashboard/org/components/org-settings/OrgDangerZoneSection.tsx`                                                                                 |
| Hook          | `ui/src/features/dashboard/org/hooks/useDeleteOrganization.ts`                                                                                                   |
| Edge function | `supabase/functions/delete-organization/index.ts`                                                                                                                |
| FK / cascade  | `supabase/migrations/20260629180000_multi_tenancy_foundation.sql`, `20260703150000_org_settings.sql`, `20260821120000_multi_tenancy_late_tables_property_id.sql` |

## Validation

Save runs **`planOrgSettingsSave`** (client) before PATCH. Only **dirty** sections that pass validation are saved — basic info and socials can save independently. Within basic information, only **changed fields** are validated for that save (contact info can save without completing unrelated basic fields). Inline field errors appear **on change** once a field has been edited, or on invalid dirty sections after a failed save.

**Nav indicators:** Incomplete required fields show a red dot on the matching section in the settings submenu and on **Settings** in the main sidebar. While editing on this page, dots reflect the draft; elsewhere they reflect the last saved snapshot via `OrgSettingsIssuesSync`.

| Area                        | Client                                                                                | Server                                            |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Organization name           | Required; 2–120 chars; uniqueness checked after typing pauses; reserved names blocked | `update-organization` + `check-organization-name` |
| Tagline / description       | Optional; max length when filled                                                      | `update-organization`                             |
| Brand color                 | Optional hex `#RRGGBB`; defaults to `#24a88e` when unset                              | `update-organization`                             |
| Facebook URL                | Optional `http(s)` URL                                                                | `org-settings` PATCH                              |
| Instagram / TikTok / Airbnb | Optional `http(s)` URL                                                                | `org-settings` PATCH                              |
| At least one social URL     | Required                                                                              | Client + `org-settings` PATCH                     |

Per-property operator settings (email routing, parking defaults, SD cron, automations) are validated on **property settings** — see **[[guides/routes/org/property/settings|Property Settings — operator guide]]**.

Danger zone: slug confirmation + `delete-organization`; blocked when booking history exists (see § Danger zone).

---

## Implementation map

| Concern                             | Path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                                | `ui/src/features/dashboard/org/pages/OrgSettingsPage.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Basic + socials + email sections    | `ui/src/features/dashboard/org/components/org-settings/OrgProfileSettingsSections.tsx`                                                                                                                                                                                                                                                                                                                                                                                                  |
| AI platform section                 | `ui/src/features/dashboard/org/components/org-settings/OrgAiPlatformSection.tsx`                                                                                                                                                                                                                                                                                                                                                                                                        |
| AI dashboard assistant section      | `ui/src/features/dashboard/org/components/org-settings/OrgAiDashboardAssistantSection.tsx`                                                                                                                                                                                                                                                                                                                                                                                              |
| Trust (Superhost progress)          | `ui/src/features/dashboard/org/components/org-settings/OrgSuperhostProgressSection.tsx`, `useOrgSuperhostProgress.ts`, `GET get-org-superhost-progress`                                                                                                                                                                                                                                                                                                                                 |
| Assistant chat panel                | `ui/src/features/dashboard/ai-assistant/components/AiAssistantPanel.tsx`, `ChatComposer.tsx`, `ChatComposerContextHub.tsx`, `ChatContextPickerPanel.tsx`, `ChatContextCommandPalette.tsx`, `ChatCanvasOverlay.tsx`, `ChatBlockRenderer.tsx`, `blocks/{ImageBlock,StepperBlock,QuickActionsBlock,ChatCanvasCompactCard}.tsx`, `ConversationHistoryList.tsx`, `lib/assistantSuggestions.ts`, `lib/chatAttachments.ts`, `lib/contextPickerRegistry.ts`, `ui/src/components/ui/command.tsx` |
| Client validation                   | `ui/src/features/dashboard/org/lib/orgSettingsCompletion.ts`, `ui/src/features/dashboard/org/lib/orgSettingsFieldError.ts`, `ui/src/features/dashboard/org/lib/orgSettingsSave.ts`                                                                                                                                                                                                                                                                                                      |
| Sidebar issue sync                  | `ui/src/features/dashboard/org/components/OrgSettingsIssuesSync.tsx`, `ui/src/features/dashboard/org/lib/orgSettingsIssuesStore.ts`                                                                                                                                                                                                                                                                                                                                                     |
| Saved completion hook               | `ui/src/features/dashboard/org/hooks/useOrgSettingsCompletion.ts`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `update-organization`               | `supabase/functions/update-organization/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Field label + optional help tooltip | `ui/src/components/forms/FieldLabel.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Brand color resolution              | `supabase/functions/_shared/orgBrandColor.ts`, `supabase/functions/_shared/appSettings.ts#resolveAppSettings`                                                                                                                                                                                                                                                                                                                                                                           |
| Guest + admin theme CSS             | `ui/src/lib/theme/brandColor.ts`, `ui/src/layouts/MainLayout.tsx`, `ui/src/features/dashboard/bookings/components/AdminBrandTheme.tsx`                                                                                                                                                                                                                                                                                                                                                  |
| App origin resolver                 | `supabase/functions/_shared/publicAppOrigin.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Social URL resolver                 | `supabase/functions/_shared/orgSocialLinks.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `org-settings`                      | `supabase/functions/org-settings/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `ai-platform-settings`              | `supabase/functions/ai-platform-settings/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `ai-platform-usage`                 | `supabase/functions/ai-platform-usage/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ai-platform-credit-wallet`         | `supabase/functions/ai-platform-credit-wallet/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `_shared/aiCreditLedger.ts`         | Credit conversion + wallet/ledger helpers                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `dashboard-assistant-settings`      | `supabase/functions/dashboard-assistant-settings/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `dashboard-assistant-chat`          | `supabase/functions/dashboard-assistant-chat/index.ts`, `_shared/dashboardAssistantAttachments.ts`                                                                                                                                                                                                                                                                                                                                                                                      |
| `dashboard-assistant-conversations` | `supabase/functions/dashboard-assistant-conversations/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Assistant attachments migration     | `supabase/migrations/20261019120000_ai_assistant_attachments.sql`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `delete-organization`               | `supabase/functions/delete-organization/index.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Social columns migration            | `supabase/migrations/20260821190000_org_settings_social_links.sql`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AI platform migration               | `supabase/migrations/20260814130000_ai_platform_hardening.sql`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AI credit foundation migration      | `supabase/migrations/20261022140000_ai_credit_foundation.sql`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| AI credit limits migration          | `supabase/migrations/20261022150000_ai_credit_limits.sql`                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AI credit hardening migration       | `supabase/migrations/20261022160000_ai_credit_foundation_hardening.sql`                                                                                                                                                                                                                                                                                                                                                                                                                 |

---

## Testing

| Layer | Path / spec                                                              | Manual                           |
| ----- | ------------------------------------------------------------------------ | -------------------------------- |
| Unit  | Org settings completion helpers when changed                             | —                                |
| E2E   | `ui/e2e/features/org/orgSettingsSave.spec.ts` socials PATCH save (`@ci`) | Logo upload, org delete, AI save |
| N/A   | —                                                                        | —                                |

---

## Related docs

- [Route index](../README.md)
- [Property Settings — AI overrides](./property/settings.md) § AI Overrides
- [Super Admin AI Management — Platform AI](../admin/settings.md) § Platform AI
- [AI dashboard assistant — feature list](../../../workflow/done/ai-dashboard-assistant-features.md)
- [AI dashboard assistant — manual tests](../../testing/ai-dashboard-assistant-manual.md)
- [`docs/architecture/validation-and-env.md`](../../../architecture/validation-and-env.md) — `PUBLIC_GUEST_APP_ORIGIN`, `FACEBOOK_REVIEWS_URL`
- [`docs/archive/operations/ai-platform-billing.md`](../../../archive/operations/ai-platform-billing.md) — billing and quota guidance
- [`docs/workflow/done/ai-usage-metering-credits-foundation.md`](../../../workflow/done/ai-usage-metering-credits-foundation.md) — credits shadow ledger + wallet plan

## Setup Guide

The same sections can be completed inside the post-onboarding [Setup Guide](./setup-guide.md) overlay (identical storage and validation).
