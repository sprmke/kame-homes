---
name: support-content
description: >-
  Checklist so every user-visible behavior change reaches the Help Center, the
  curated FAQ layer, and public support surfaces in the same change. REQUIRED
  when adding or changing a route guide, feature copy, FAQ, help surface,
  public support page, or guest help content. Mirrors always-on Cursor rule
  support-content.mdc. Use before claiming any material task done.
---

# Support content (docs to help surfaces)

**Non-negotiable:** support content is part of the product change, not a follow-up. A feature that ships with stale FAQs is an incomplete feature.

Sources of truth:

| Source                                        | Feeds                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs/guides/routes/**` Host-facing knowledge | Help Center **Guides** tab + AI assistant (`ai_dashboard_assistant_knowledge_base`) |
| `docs/guides/support/faqs.md`                 | Help Center **FAQs** tab, guest Help, public `/support`, AI FAQ search              |
| `docs/guides/routes/**` behavior sections     | Route guides for operators and agents                                               |

Always-on rule: **`.cursor/rules/support-content.mdc`**. This skill is the full checklist (Claude Code / OpenCode / skill picker).

## When this applies

- New or changed page, section, save flow, validation, status, or permission
- New guest or host feature, integration, or plan-gated capability
- A bug fix that changes what a host or guest can do
- Any edit to `docs/guides/routes/**` or `docs/guides/support/faqs.md`

**Skip only:** typos, internal renames with no behavior change, and pure refactors that do not alter what a host or guest sees or does.

## Step 1 — Update the route guide

1. Open the matching guide under `docs/guides/routes/` (see `docs/guides/routes/README.md`).
2. Update behavior, save path, validation, permissions, and edge cases.
3. Fix any answer the code change makes wrong. Do not leave a stale FAQ because the old wording looked fine.

## Step 2 — Update Host-facing knowledge

For every changed guide:

- Major module pages need **5+ Q&A**; other documented guides need **3+**.
- Write for a host, not an engineer: no code, no database columns, no internal endpoint names.
- Follow **`human-copy`**: short, plain, no em dashes, no AI tells.
- If the change adds a new page, add a `## Host-facing knowledge` section.

## Step 3 — Update the curated FAQ layer

Add or correct cross-cutting answers in `docs/guides/support/faqs.md` when the change affects:

- billing, plans, or seats
- sign-in, access, or invites
- guest trips, messages, vouchers, reviews, or tickets
- a capability hosts ask about across properties (marketing, analytics, activity, announcements)

Rules:

- One `### Question` block per FAQ.
- `category` must exist in `ui/src/features/dashboard/help-support/lib/helpFaqModules.ts`.
- `audience` is `host`, `guest`, or `public`.
- `source` must point at a real route guide.
- Plan names: use host-facing names (`growth` is **Pro**, `pro` is **Business**). Never mention retired `business_plus` or `commission`.
- Do not paraphrase an existing vetted answer without a reason. Correct it only when the product changed.

## Step 4 — Update the public and guest surfaces

When the change affects what guests or the public see:

- `/support`: published FAQs render from `list-public-support-faqs`. The static fallback must still be accurate.
- Guest account Help: `/account/help` shows `audience = guest` and `public` answers.
- `audience = public` appears on both host and guest surfaces.
- Guest chat prompt starters (`guestChatSuggestions.ts`) are prompts, not answers. Extend them when a new guest feature has no prompt.

## Step 5 — Run the guards

```bash
bun run check:support-content          # curated doc format + source paths + categories
bun run check:ai-knowledge-coverage    # route-guide Q&A minimums
bun run test:support-content           # parser + provenance tests
bun scripts/sync-ai-knowledge-base.ts --dry-run
```

Then run the real sync locally (`bun run sync:support-content`) when the DB is up. CI runs it on `develop` for docs changes.

## Step 6 — Provenance safety (only when touching sync)

- Synced rows are `origin = 'synced'`; super-admin rows are `origin = 'manual'`.
- Never delete, update, or read manual rows from the sync.
- Preserve `is_published` on update so a super-admin unpublish survives.
- Prune synced rows only when their `content_key` disappears from the docs.

## Finish checklist

- [ ] Matching route guide updated (behavior + Host-facing knowledge)
- [ ] Curated FAQ updated when the change is cross-cutting
- [ ] Plan names and retired tiers checked
- [ ] No em dashes or AI tells in new copy
- [ ] `check:support-content`, `check:ai-knowledge-coverage`, and `test:support-content` pass
- [ ] Dry-run sync parses the changed docs
- [ ] Route guide **Testing** row updated when the page journey changed

## Related

- Always-on rule: **`.cursor/rules/support-content.mdc`**
- Routes: **`route-guides`** · Docs: **`documentation-maintenance`** · Copy: **`human-copy`**
- Pipeline: `scripts/sync-ai-knowledge-base.ts`, `scripts/check-support-content.ts`, `scripts/lib/supportContent.ts`
- Plan: **`docs/workflow/in-progress/support-content-and-faq-sync.md`**
