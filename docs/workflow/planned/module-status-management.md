---
stage: planned
title: 'Module status management (Coming Soon / Maintenance) — Super Admin'
status: planned
tags: [planning, planned-modules, super-admin, admin, feature-gating, plans-and-permissions]
updated: 2026-09-05
---

# Module status management

## Problem

Several already-built features aren't confident-to-ship-to-everyone yet, and not all for the same reason:

| Module                            | Why it's not fully public                                                           | Current state                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meta connection** (Guest Inbox) | Needs Facebook App Review approval before the OAuth flow can go live for real hosts | Built, gated only by plan tier (`metaChatChannel`) — no "not approved yet" story                                                                                           |
| **AI dashboard assistant**        | Complete, but the team wants an instant on/off switch                               | Already has a global kill switch (`AiDashboardAssistantKillSwitchCard`) + plan gate — just no unified place to manage it alongside other "not ready" features              |
| **AI (voice) receptionist**       | Same — wants a deliberate soft-launch                                               | Already has a **two-tier** kill switch (global + per-property), shipped per `../done/ai-voice-receptionist.md` — same gap as above                                         |
| **Marketing Studio**              | Team isn't confident yet                                                            | **Already shipped and in active use** (`../done/marketing-module-refinement.md`) — no gate today                                                                           |
| **Public Pages / page editor**    | Team isn't confident yet                                                            | **Already shipped** (`../done/page-editor-public-pages.md`, `../done/custom-pages-module.md`) — explicitly _ungated on entry_ today (only the _save_ action is plan-gated) |

None of these are really the same situation — "we haven't launched this yet" (Meta connection) and "this was working and we're pulling it for a bit" (a hypothetical future maintenance pass on, say, the pricing calendar) deserve different copy, tone, and urgency, even if the underlying mechanism (block the surface, explain why) is identical. A single `coming_soon` boolean can't express that difference, so this plan generalizes the earlier "Coming Soon" idea into a small, **extensible module status** with a distinct visual preset per status — starting with `coming_soon` and `maintenance`, designed so a third status (e.g. `beta`, `deprecated`) is a preset addition, not a schema redesign.

## ⚠️ Read before building: default-status risk

Marketing Studio and Public Pages editor are **already live and in use**. Assigning either any non-`live` status at rollout would immediately hide a working feature from every current host — a real regression, not a cosmetic one. This plan builds the _mechanism_ only; **initial status per module is a product decision Super Admin makes after this ships**, not something to hardcode. Recommended safe defaults (spelled out again in Rollout below): seed already-shipped, already-relied-upon modules as `live`, seed genuinely-unreleased ones (Meta connection) as `coming_soon`, and leave the two AI kill-switch modules exactly as they already are (no behavior change, just a unified admin view). If the intent is really "hide Marketing Studio / Public Pages from everyone right now," say so explicitly before Phase 4 ships — that flag is one `UPDATE` away either way.

## Architecture decision: a thin, additive "status" layer — not a rewrite

Two of the five target modules (AI dashboard assistant, AI receptionist) already have working, shipped gating infrastructure:

- `ui/src/features/dashboard/super-admin/components/AiDashboardAssistantKillSwitchCard.tsx` → `useAiDashboardAssistantGlobalSettings`/`useUpdateAiDashboardAssistantGlobalSettings` → dedicated settings table, consumed by `useAiAssistantAccess.ts` (`ui/src/features/dashboard/ai-assistant/hooks/useAiAssistantAccess.ts:27-31`) which ANDs together `platformEnabled && enabled && !propertyDisabled && planGate.allowed`.
- `AiPlatformKillSwitchCard.tsx` (broader AI platform switch) — same shape.
- Voice receptionist: `voice_receptionist_global_settings` (singleton) + `voice_receptionist_settings` (per-property), per `../done/ai-voice-receptionist.md` decision #4.

**Do not duplicate these into a second, competing boolean.** Instead:

1. Build one new, generic **`module_status_registry`** (table + CRUD) that is the _only_ new source of truth for the three modules that have **no** existing gate today: Meta connection, Marketing Studio, Public Pages editor.
2. For the two modules that already have dedicated settings, the new Super Admin list page **displays and edits them through their existing hooks/edge functions** (an "adapter" row) — those two stay a binary on/off (their existing settings have no maintenance concept), shown in the same list for a single pane of glass, but not migrated. No change to `voice_receptionist_*` or the AI settings tables.
3. Any _future_ module that needs a status and has no dedicated settings yet gets a `module_status_registry` row instead of new bespoke infra — this is the reusable part of the investment.

This keeps the two already-shipped, tested kill switches completely untouched (zero regression risk) while giving Super Admin the single pane of glass the user asked for, generalized to more than one kind of "not fully available."

## Status model

A small, extensible enum — Postgres `TEXT` + `CHECK` (not a Postgres `ENUM`), the same convention the booking-status workflow already uses in this repo specifically because it lets a later migration add a value without an `ALTER TYPE` dance:

```sql
status TEXT NOT NULL DEFAULT 'coming_soon'
  CHECK (status IN ('live', 'coming_soon', 'maintenance'))
```

- **`live`** — no gate anywhere; the module behaves exactly as if no row existed (see fail-open note below).
- **`coming_soon`** — never released; framing is "not yet," forward-looking, no urgency.
- **`maintenance`** — was working, temporarily pulled; framing is "back shortly," different tone/urgency from `coming_soon` even though the _mechanism_ (block + explain) is the same.
- Adding a fourth value later (e.g. `beta`, `deprecated`) means: extend the `CHECK` constraint in a new migration + add one preset entry in code (below) — no component rewrite, no new table.

Each status maps to a **code-side preset** (not admin-editable — visual identity per status should stay consistent platform-wide), while the row's `badge_text`/`description` still let an admin write module-specific copy on top of the preset:

```ts
// ui/src/lib/moduleStatus/moduleStatusPresets.ts
export const MODULE_STATUS_PRESETS: Record<
  Exclude<ModuleStatus, 'live'>,
  {
    defaultBadgeText: string;
    defaultDescription: string;
    icon: LucideIcon;
    tone: 'neutral' | 'amber'; // maps to Tailwind classes in the shared badge/overlay components
  }
> = {
  coming_soon: {
    defaultBadgeText: 'Coming soon',
    defaultDescription: "We're not ready to open this up yet.",
    icon: Sparkles,
    tone: 'neutral',
  },
  maintenance: {
    defaultBadgeText: 'Under maintenance',
    defaultDescription: 'Temporarily unavailable while we fix something. Back shortly.',
    icon: Wrench,
    tone: 'amber',
  },
};
```

`neutral` reads as "future," `amber` reads as "temporary interruption" — same badge/overlay/inline-gate _components_, different `tone` prop, so no per-status component fork. (v1 does not attempt a lighter-touch "keep the feature visible but read-only" treatment for `maintenance` — it fully blocks like `coming_soon` does. If that distinction turns out to matter in practice, it's a follow-up, not a blocker — see Open questions.)

## Data model

New migration `supabase/migrations/<ts>_module_status_registry.sql`, modeled directly on the FAQ table (`supabase/migrations/20261021120000_help_center_faqs.sql`) — same shape, same RLS convention:

```sql
CREATE TABLE IF NOT EXISTS public.module_status_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,          -- e.g. 'meta-connection', 'marketing-studio'
  label TEXT NOT NULL,                      -- Super Admin list + fallback display name
  status TEXT NOT NULL DEFAULT 'coming_soon'
    CHECK (status IN ('live', 'coming_soon', 'maintenance')),
  badge_text TEXT,                          -- override for the status preset's default copy
  description TEXT,                         -- override for the status preset's default copy
  sort_order INT NOT NULL DEFAULT 0,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_module_status_registry_updated_at
  BEFORE UPDATE ON public.module_status_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON public.module_status_registry TO service_role;

ALTER TABLE public.module_status_registry ENABLE ROW LEVEL SECURITY;

-- Every signed-in dashboard/guest user can read status — this is presentational,
-- never sensitive. Same convention as help_center_faqs_select.
CREATE POLICY module_status_registry_select ON public.module_status_registry
  FOR SELECT TO authenticated USING (true);
```

`badge_text`/`description` are nullable — when null, the consuming hook falls back to the status preset's default copy (above), so creating a row is a one-field decision (pick a `status`) with copy customization as an optional extra, not a requirement.

**Fail-open semantics, by design**: a `module_key` with **no row** is treated as `live` everywhere it's consulted. Deleting a row = "stop managing this module here," not "hide it" — this makes `delete` a safe, low-drama CRUD action (no accidental lockout) and matches how every other feature in the app behaves today (nothing is hidden unless something explicitly says so).

`gate_style` (badge vs. overlay vs. modal vs. nav-pill) is **not** a DB column — it's a hardcoded per-surface decision in code (see Per-feature integration below), because it depends on the actual UI shape of each screen, not something an admin should improvise per row. The CRUD screen only edits `label`, `status`, `badge_text`, `description`, `sort_order`.

`module_key` is a free-text slug (not a DB enum) so future modules don't need a migration, but the client keeps a typed allowlist for the five known keys (see below) for compile-time safety at existing call sites.

## Edge functions

Mirror the FAQ CRUD split exactly (`supabase/functions/{list,create,update,delete}-help-center-faq*`):

- `list-module-statuses` — `serveSuperAdmin`, GET, returns all rows ordered by `sort_order`. No pagination needed (five-ish rows).
- `create-module-status` — `serveSuperAdmin`, POST, validates `module_key` (slug format, unique), `label`, `status` (one of the 3 enum values).
- `update-module-status` — `serveSuperAdmin`, POST, partial update by `id`.
- `delete-module-status` — `serveSuperAdmin`, POST, delete by `id`.

Reads for the _consuming_ surfaces (host dashboard, guest chat) go **directly through supabase-js with the RLS policy above** — no new public edge function needed, same as how `help_center_faqs` reads work today. One shared TanStack Query hook fetches the full list once and every gate component reads from that cache (see Client architecture).

Each mutation should call `logSuperAdminAction` (shipped — see [`../done/super-admin-audit-log.md`](../done/super-admin-audit-log.md)).

## Super Admin UI

Template: **`SuperAdminHelpFaqsPage.tsx`** (`/admin/support/faqs`) — closest existing precedent (row control for a status + edit dialog + delete confirm), not the pricing-plans editor (too accreted) or announcements (folded into a settings blob).

- **List page** `ui/src/features/dashboard/super-admin/pages/SuperAdminModuleStatusPage.tsx` at `/admin/module-status`:
  - One row per module: label, description snippet, a **status `Select`** (`Live` / `Coming soon` / `Under maintenance`) firing an update mutation directly on change (mirrors the FAQ `is_published` `Switch`, just a 3-way control instead of 2-way), edit icon → dialog, delete icon → `AlertDialog` confirm.
  - Each row shows a small colored dot/pill next to its status matching the preset `tone` (neutral for `coming_soon`, amber for `maintenance`, green/none for `live`) so the whole list is scannable at a glance.
  - The two adapter rows (AI dashboard assistant, AI receptionist) render in the **same list**, visually similar, but their control is a plain `Switch` (they're binary — no maintenance concept in their existing settings) that calls the _existing_ `useUpdateAiDashboardAssistantGlobalSettings` / voice-receptionist global-settings mutation instead of `update-module-status` — implement this as a small client-side adapter map, not a table flag, so the list page component stays generic:
    ```ts
    // ui/src/features/dashboard/super-admin/lib/moduleStatusAdapters.ts
    type ModuleStatusAdapter = { useStatus: () => {...}; useToggle: () => {...} } | null;
    const MODULE_STATUS_ADAPTERS: Record<string, ModuleStatusAdapter> = {
      'ai-dashboard-assistant': { useStatus: useAiDashboardAssistantGlobalSettings, useToggle: useUpdateAiDashboardAssistantGlobalSettings },
      'ai-receptionist': { useStatus: useVoiceReceptionistGlobalSettings, useToggle: useUpdateVoiceReceptionistGlobalSettings },
    };
    ```
  - `SuperAdminEmptyState` when no registry rows exist yet (first run, before seeding).
- **Add/edit dialog** `SuperAdminModuleStatusDialog.tsx`: `module_key` (locked/read-only on edit; on create, a `<select>` of the 5 known keys **plus** a free-text "custom" option), `label`, `status` (select — choosing a value pre-fills `badge_text`/`description` from that status's preset, both still editable).
- **Registration** (3 edits, per the established convention):
  1. `superAdminPaths.moduleStatus = '/admin/module-status'` in `superAdminPaths.ts`.
  2. Nav entry in the **"Platform"** group of `SUPER_ADMIN_NAV_GROUPS` (`superAdminPlatformNav.ts:72-80`) — sits naturally next to "AI Management" and "Platform settings."
  3. `<Route path="module-status" element={<SuperAdminModuleStatusPage />} />` in `super-admin/routes/index.tsx`.

## Client architecture (shared gating primitives)

New cross-cutting location (used by both dashboard and guest code, so it doesn't belong inside one feature folder): `ui/src/lib/moduleStatus/`.

- `moduleStatusKeys.ts` — typed union:
  ```ts
  export type ModuleStatusKey =
    | 'meta-connection'
    | 'ai-dashboard-assistant'
    | 'ai-receptionist'
    | 'marketing-studio'
    | 'public-pages-editor';

  export type ModuleStatus = 'live' | 'coming_soon' | 'maintenance';
  ```
- `moduleStatusPresets.ts` — the preset table above.
- `moduleStatusApi.ts` — `fetchModuleStatuses()` via `supabase.from('module_status_registry').select('*')` (direct client read, RLS-gated, same pattern as FAQs).
- `useModuleStatuses.ts` — one shared `useQuery` (`staleTime: 5 * 60_000`, matches the plan-data caching convention) returning the full list.
- `useModuleStatus(moduleKey)` — derives from the shared query: `{ status, isLive, label, badgeText, description, icon, tone, isLoading }`, where `badgeText`/`description`/`icon`/`tone` fall back to the preset for `status` when the row doesn't override them. **Fail-open**: no row → `status: 'live'`, `isLive: true`.

Visual components, one per gate shape already established by the plan-gating system (`FeatureGate.tsx`/`TierBadge.tsx`/`PlanGateWatermarkOverlay.tsx`/`RequirePropertyFeature.tsx` — same shapes, status-driven styling instead of plan-upsell styling so hosts never confuse this with a billing block):

- `ModuleStatusBadge.tsx` + `ModuleStatusBadgeAnchor.tsx` — small pill, modeled 1:1 on `TierBadge`/`TierBadgeAnchor` (`ui/src/features/dashboard/plans/components/TierBadge.tsx:36-88`), color driven by `tone` (`bg-muted text-muted-foreground` for neutral, amber-50/700 for amber) instead of `bg-primary`, tooltip = the row's `description`.
- `RequireLiveModule.tsx` — route-level guard, modeled 1:1 on `RequirePropertyFeature.tsx`: full-page centered card, the status preset's icon (`Sparkles` for coming soon, `Wrench` for maintenance), "`{label}` {is coming soon / is under maintenance}," the row's `description`, a "Back to dashboard" button (no upgrade CTA — nothing to buy).
- `ModuleStatusInlineGate.tsx` — wraps a single button/card action (the Meta "Connect" button shape): renders `ModuleStatusBadgeAnchor` + disables the wrapped control + intercepts the click to show a small popover/toast with the `description` instead of running the real handler. Modeled on `FeatureGate.tsx`'s `disable` mode (`FeatureGate.tsx:67-80`).

## Per-feature integration (the "best location per screen" part)

| #   | Module                     | Surface (file:line)                                                                                                                                                         | Gate shape                                                                                                                                                                                                                                                                                                                  | Why this shape                                                                                                                                                                                                                                             |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Meta connection**        | `ui/src/features/dashboard/inbox/components/InboxChannelsTab.tsx:236-252` ("Connect Meta" button) and `:255-274` ("Reconnect")                                              | `ModuleStatusInlineGate` wrapping the button, replacing/sitting alongside the existing `TierBadgeAnchor`                                                                                                                                                                                                                    | It's a settings-row action, not a page — the existing plan-tier badge already anchors here, so a status pill in the same spot reads as "one more reason this isn't available yet," not a second unrelated UI                                               |
| 2   | **AI dashboard assistant** | FAB visibility: `isAiAssistantFabVisible(...)` used in `AdminLayout.tsx:677`, sourced from `useAiAssistantAccess.ts:27-31`                                                  | **No new visible gate** — this module is adapter-only, binary (see Architecture). Super Admin toggles the existing kill switch via the unified list; the FAB already fully hides when disabled                                                                                                                              | It's a floating global control with no natural anchor point for a badge; a hidden FAB is already the correct, tested UX — don't add chrome that isn't needed                                                                                               |
| 3   | **AI receptionist**        | `ui/src/features/guest/chat/components/GuestChatHeaderBar.tsx:75-85` ("Talk to receptionist" menu item, only rendered when `onStartVoiceSession` is passed)                 | Render the item **disabled** with a trailing `ModuleStatusBadge` (`coming_soon` preset) + tooltip, instead of omitting it entirely                                                                                                                                                                                          | Adapter-only like #2 (existing two-tier kill switch stays the source of truth, still binary) — but unlike the FAB, a menu item benefits from being _discoverable-but-not-yet-available_ rather than invisible, so guests know the capability exists        |
| 4   | **Marketing Studio**       | Sidebar: `ui/src/features/dashboard/bookings/lib/adminSidebarNav.ts:163-167`; route: `ui/src/features/dashboard/marketing/routes/index.tsx:9` → `MarketingStudioPage`       | Sidebar item stays a **live, clickable `Link`** with a small status pill next to the label (extend `SidebarNavItem` with an optional `moduleStatusKey`, render `ModuleStatusBadge` in `AdminLayout.tsx` next to `SectionNavIssueDot`, `AdminLayout.tsx:892-898`); the route itself wraps its content in `RequireLiveModule` | Top-level nav item routing to a full page — same treatment as the existing plan-gated `RequirePropertyFeature` pattern, so hosts get one consistent "this section isn't available" experience whether the reason is plan tier, coming-soon, or maintenance |
| 5   | **Public Pages editor**    | Sidebar: `adminSidebarNav.ts:183-187`; routes: `ui/src/features/dashboard/custom-pages/routes/index.tsx:19-25` (`CustomPagesPage`) + `page-editor/pages/PageEditorPage.tsx` | Same as #4 — nav pill + `RequireLiveModule` wrapping both the gallery and the editor route                                                                                                                                                                                                                                  | Same full-page nav shape; note this module is **currently open-explore-by-design** (paywall only on save) — gating it this way is a strictly bigger behavior change than #4, flagged in the risk callout above                                             |

`SidebarNavItem.disabled` (`adminSidebarNav.ts:55`, rendered as an inert opacity-50 `<div>` at `AdminLayout.tsx:849-864`) is **not** used for #4/#5 — that pattern removes the link entirely with no explanation, which is worse UX than "click through, see why." Reserve `disabled` for its current use (permission-based hiding); module status uses the new pill + route guard instead, and the pill's tone/icon already communicates _why_ (soon vs. temporarily down) without needing separate nav treatments per status.

## Seed data & rollout recommendation

Seed the table (via a data migration or a one-time Super Admin session) with:

| module_key            | status                                        | badge_text                            |
| --------------------- | --------------------------------------------- | ------------------------------------- |
| `meta-connection`     | `coming_soon`                                 | _(use preset default: "Coming soon")_ |
| `marketing-studio`    | `live` _(already shipped — see risk callout)_ | —                                     |
| `public-pages-editor` | `live` _(already shipped — see risk callout)_ | —                                     |

`ai-dashboard-assistant` / `ai-receptionist` don't get registry rows at all — they're adapter-only and already reflect whatever their existing binary settings say today (no change). `maintenance` has no initial seed use; it exists so a future incident/rollback on any already-`live` module (registry or adapter-eligible) has a ready-made, on-brand "temporarily down" treatment instead of someone improvising a toast at 2am.

## Phasing

1. **Migration + edge functions** — `module_status_registry` table, 4 CRUD functions, `config.toml` entries.
2. **Super Admin CRUD UI** — list page, dialog (with status presets), nav/route registration, seed the 3 genuine rows above.
3. **Shared client primitives** — `useModuleStatus`, `ModuleStatusBadge`/`Anchor`, `RequireLiveModule`, `ModuleStatusInlineGate` under `ui/src/lib/moduleStatus/`.
4. **Wire the 3 net-new surfaces** — Meta connection inline gate, Marketing Studio nav pill + route guard, Public Pages nav pill + route guard (confirm with the user whether Public Pages should actually gate on entry given its current open-explore design — see risk callout).
5. **Wire the 2 adapter surfaces** — AI dashboard assistant list row (read/write via existing hooks, no UI change at the FAB), AI receptionist list row + disabled-menu-item treatment in `GuestChatHeaderBar.tsx`.
6. **Docs** — per `documentation-maintenance`/`route-guides` (mandatory, this changes page-entry UX): update `docs/PROJECT.md` (new table/edge functions), route guides for `org/property/marketing.md`, `org/property/public-pages.md` (check exact filenames under `docs/guides/routes/org/property/`), `.claude/README.md` if a new skill/pattern is worth indexing, and this file's status once shipped.

## Verification

1. `bun run type-check` / `lint` / `build`.
2. `mcp__supabase__get_advisors` after the migration — confirm RLS posture on the new table.
3. Manual: cycle each of the 3 net-new modules through all three statuses in `/admin/module-status`, confirm the exact surface in the table above reacts correctly for both `coming_soon` and `maintenance` (different icon/copy/tone, same block behavior), with no console errors and no dead links.
4. Manual: confirm deleting a row reverts that surface to fully live (fail-open check).
5. Manual: confirm the 2 adapter rows' controls still drive the _original_ settings tables (spot-check via `mcp__supabase__execute_sql` that no new duplicate flag was written).
6. Mobile pass (375/768/1024px) on the nav pill and `RequireLiveModule` full-page state, per `mobile-responsive`.
7. `human-copy` pass on all new badge/description copy (no AI tells, no em dashes, short) — including both status presets.

## Open questions (resolve before Phase 4)

- **Public Pages editor**: is a non-`live` status meant to gate entry entirely (bigger change, reverses its current open-explore design), or only specific sub-features within it? Confirm before wiring #5.
- **Marketing Studio**: same question — confirm this means a temporary rollback/soft-launch decision, not something narrower (e.g., just the AI-generation or Meta-publishing sub-features inside it).
- **Maintenance depth**: v1 treats `maintenance` as a full block, identical in mechanism to `coming_soon` (different copy/tone only). If a future need is "keep the screen visible and read-only during maintenance" instead of fully blocking it, that's a distinct gate mode (`FeatureGate`'s `watermark`/`disable` split is the precedent) — worth a follow-up plan once a real maintenance scenario shows up, not speculative work now.
- `logSuperAdminAction` audit-logging is shipped — wire it when implementing mutations (see [`../done/super-admin-audit-log.md`](../done/super-admin-audit-log.md)).
