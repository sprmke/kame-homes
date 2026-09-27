---
name: plans-and-permissions
description: >-
  Checklist so new host features always consider Plans entitlements and Team
  role permissions (or explicitly mark N/A). REQUIRED when adding dashboard
  modules, gated actions, Channel-sync-like capabilities, settings surfaces,
  or paid features. Mirrors always-on Cursor rule plans-and-permissions.mdc.
  Use before claiming feature work done.
---

# Plans + team permissions (new features)

**Non-negotiable:** every new product capability must **decide** subscription tier gates and team RBAC in the **same** change — not “we’ll add permissions later.”

Cursor always-on: **`.cursor/rules/plans-and-permissions.mdc`**. This skill is the full checklist (Claude Code / OpenCode / skill picker).

## When this applies

- New host dashboard module, page, modal, or settings section
- New edge write path that changes property/org/parking data
- Paid / tier-limited capabilities (like Airbnb Channel sync)
- New “can this role do X?” behaviors

**Skip only:** pure bugs, renames, internal refactors with no new capability, guest-anon public flows with no host controls.

## Step 0 — Decide (write it down)

| #   | Decision                                                                   | Outcomes                                                                                                    |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A   | **Plans?** Limited by Free / Starter / Pro / Business / Managed?           | **Yes** → Step 1 · **No** → note N/A + why (core loop, already free, etc.)                                  |
| B   | **Team permissions?** Should Operations / Read Only / custom roles differ? | **Yes** → Step 2 · **No** → note N/A (owner-only surface, or covered by existing leaf e.g. `settings:view`) |

Gold example — **Channel sync**:

|             | Choice                                                                     |
| ----------- | -------------------------------------------------------------------------- |
| Plans       | `calendarSync` — Pro (`growth`) and above                                  |
| Permissions | `pricing.channels:view` / `pricing.channels:edit` under Pricing            |
| UX          | Preview-open UI; gate **Connect** / enable **Share**; `TierBadge` on entry |

---

## Step 1 — Plans (when A = yes)

Do **all** that apply:

1. **Key** — add to `supabase/functions/_shared/planFeatures.ts` **and** `ui/src/features/dashboard/plans/lib/planFeatures.ts` (types, defaults, labels) — keep mirrors identical.
2. **Seed** — **new** migration updating `pricing_plans.features` JSONB per tier (`true`/`false` by `code`). Never edit shipped migrations.
3. **Server** — `requirePropertyFeature` / `requireOrgFeature` / `isFeatureEnabled` on **writes** (and cron sweeps). Prefer **preview-open** reads when hosts should browse UI below the tier.
4. **Client** — `useFeatureGate('…')`; upgrade via `openUpgradeModal`; `TierBadge` / `TierBadgeAnchor` on entry actions; interactive-block on commit actions (not a blank locked page unless product requires hide).
5. **Presentation** — `planPresentation.ts` (`PLAN_FEATURE_ROWS`, tier-card gains), `featureGateCopy.ts`, live **`/for-hosts/pricing`**.
6. **Docs** — `docs/architecture/plans-feature-matrix.md` (+ gate inventory row if maintained), route guide, `docs/PROJECT.md` if API/env touched.
7. **Tests** — update `plans/lib/planTierGolden.ts` (`GOLDEN_MINIMUM_TIER`), `planTierExpectations.ts` and the `GATE_COVERAGE` map in `planGateCoverage.test.ts`; add the gated surface to `ui/e2e/features/plans/gates/featureGates.spec.ts`; run `bun run check:plan-catalog` after `db:reset`.

Canonical matrix: **`docs/architecture/plans-feature-matrix.md`**.

---

## Step 2 — Team permissions (when B = yes)

Permission id shape: `module.leaf:action` (`view` \| `add` \| `edit` \| `delete`).

Do **all** that apply for the correct scope:

| Scope    | UI catalog                                                                  | Server allow-list                                       |
| -------- | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Property | `ui/.../team/lib/propertyTeamConstants.ts` + `propertyPermissionCatalog.ts` | `supabase/functions/_shared/propertyTeamPermissions.ts` |
| Org      | org team constants / catalog                                                | `orgTeamPermissions.ts`                                 |
| Parking  | `parkingTeamConstants.ts`                                                   | `parkingTeamPermissions.ts`                             |

Also:

1. **Catalog** — group node + chip labels. Plan pills come from `PLAN_FEATURE_PERMISSION_COVERAGE` (`ui/src/features/dashboard/plans/lib/planFeaturePermissions.ts`): map every new `PlanFeatureKey` to leaves (e.g. `calendarSync` → `pricing.channels:*`) or record an explicit N/A reason. `planFeaturePermissions.test.ts` fails otherwise.
   1a. **Split leaves** — when a new leaf carves out of an existing one (e.g. `marketing.generate.image:add` from `marketing.generate:add`), ship a backfill migration granting it to holders of the source leaf. Do not use read-time expansion; the new leaf must stay revocable.
   1b. **Credit-spending actions** get their own leaf (image, video, AI review, Smart Pricing) and are excluded from the seeded Operations template.
2. **Seeded templates** — Full Access / Operations / Read Only grants in `SEEDED_TEMPLATE_PERMISSIONS` (and org/parking equivalents).
3. **Server** — `resolveScopedPropertyAccess('…')` (or parking/org) on every mutating handler; never UI-only checks.
4. **Client** — hide entry without `:view`; disable mutations without `:edit` / `:add` / `:delete`.
5. **Docs** — route guide **Permissions** table + Host Q&A; multi-tenancy skill if new scope.

Keep UI and edge permission id lists **byte-sync** — same rule as `statusMachine` client/server mirrors.

---

## Step 3 — Finish checklist

- [ ] Plans decision recorded (implemented **or** explicit N/A)
- [ ] Team permissions decision recorded (implemented **or** explicit N/A)
- [ ] If plan-gated: migration + both `planFeatures.ts` + matrix + gate UX
- [ ] If RBAC: UI + edge permission ids + catalog + templates + scoped access
- [ ] Route guide / matrix / `PROJECT.md` updated in the **same** change
- [ ] No “permissions later” / “plans later” left for the user

## Related

- Always-on rule: **`.cursor/rules/plans-and-permissions.mdc`**
- Docs: **`documentation-maintenance`** · Routes: **`route-guides`** · Scope: **`multi-tenancy`**
- Matrix: **`docs/architecture/plans-feature-matrix.md`**
