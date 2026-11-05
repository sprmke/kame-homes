---
stage: for-testing
title: 'Marketing AI Studio — conversations with versions, and Library polish'
status: for-testing
tags: [workflow, marketing, ai, ux, mobile-responsive]
updated: 2026-10-21
kind: plan
---

# Marketing AI Studio — conversations with versions, and Library polish

**Route:** `/org/:orgSlug/property/:propertySlug/marketing` · **Guide:** [`marketing.md`](../../guides/routes/org/property/marketing.md) · **Follows:** [`marketing-studio-library-and-workspace-redesign.md`](../for-testing/marketing-studio-library-and-workspace-redesign.md)

## 1. Problem

1. AI Studio is a long form plus a feed. Every other tab opens on the host's own work; AI Studio opens on controls.
2. There is no way to keep improving one result. "Edit this photo" refills the form, and the new photo lands somewhere else in the feed. Posts can only be regenerated as a fresh batch.
3. The form shows everything at once: output tiles with hints and badges, goal chips, ideas, photos, looks, camera, format cards, quality cards, More options.
4. Library chrome is scattered: theme bar in the page header, "New post" in the card header, size buttons as four separate pills, "Make with AI" vs "Start with AI", and a toolbar row of six unrelated controls.

## 2. Decisions (confirmed 2026-10-20)

| #   | Decision                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Conversations and versions are **saved on the server** (new table, migration). Existing photos and clips each become one conversation.                                                                                                                                                    |
| S2  | **Refine by prompting for all three outputs.** Post: one small AI call revises the current post. Photo: a new photo built from the current version plus the instruction. Clip: a new 8s clip from the same start photo (video models cannot edit a clip); the Send button shows the cost. |
| S3  | **New creation is 2 steps:** pick Post / Photo / Clip, then one prompt box with photos and size; everything else under Advanced.                                                                                                                                                          |

## 3. Target experience

### 3.1 Shared Library frame (all four tabs)

```
┌ Marketing ──────────────────────────────────────────────────────────┐
│ [AI Studio  Posts  Videos  Calendar]          Themes › Property ▾ ✎ │  ← tab row: theme bar on the right
├─────────────────────────────────────────────────────────────────────┤
│ [+ New post ▾]  [✦ Create with AI]                                  │  ← create strip, inside content
│                                                                     │
│ Your posts 24                [⌕ Search] [Filters •2] [☐ Select] [🗑] │  ← one toolbar row
│ (Story ×) (All themes ×)                                            │  ← active filter chips
│ ▢ ▢ ▢ ▢ ▢                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

- Theme bar (Themes › name ▾ · Customize) moves from the page header into the tab row's right side on desktop; phones keep it as the first row.
- **New {item}** is a split button: the main part opens the template gallery, the chevron opens sizes (each with its shape glyph). Replaces the four separate size pills.
- **Create with AI** everywhere (one label). Posts → AI Studio's Post flow; Videos / Calendar → editor AI panel.
- Toolbar: title + count, search, **Filters** popover (Size, Sort, Theme: This theme / All themes as segmented controls), **Select** toggle, **Recently deleted** icon button with tooltip. Active filters render as removable chips. Phones: search + Refine sheet (unchanged pattern) with Select / Recently deleted inside.

### 3.2 AI Studio home

Same frame. Create strip = three output cards (Post, Photo, Clip) — step 1 of the 2-step flow. Below: **Your creations** grid of conversations (cover = latest version, title, output icon, version count, edited time), toolbar with Type filter (All / Posts / Photos / Clips) instead of size, Select, Recently deleted.

### 3.3 New creation (step 2) — `?tab=generate&session=new&output=image`

Focus mode (tabs hidden, Back). Centered composer card:

- Prompt textarea + up to three example chips when empty.
- Photo: photo strip (`+ Add` tile). Clip: one start photo. Post: listing photos are automatic; **Angle** chips (Vibe, Promo, Amenities, Feature, Stay info).
- **Size** as one compact dropdown chip.
- **Advanced** (collapsed): Look, Quality, Image size, Camera, Resolution, Sound, Auto-improve.
- Generate · credits.

On submit the conversation is created, the URL is replaced with `session=<id>`, and the workspace opens.

### 3.4 Conversation workspace — `?tab=generate&session=<id>`

```
┌ ← AI Studio   Sunset balcony ✎                 [Download] [Publish] ⋯ ┐
├──────────────────────────┬───────────────────────────────────────────┤
│ You  Balcony at golden…  │                                           │
│  ▣V1                     │            ┌─────────────┐                │
│ You  Make it evening     │            │   preview   │                │
│  ▣V2  ◉                  │            └─────────────┘                │
│ You  Closer view         │              ‹  V2 of 3  ›                │
│  ▣V3                     │                                           │
│ ┌──────────────────────┐ │                                           │
│ │ Describe a change…   │ │                                           │
│ │ (Brighter)(Evening)  │ │                                           │
│ │ ⚙ Settings  Send · 35│ │                                           │
│ └──────────────────────┘ │                                           │
└──────────────────────────┴───────────────────────────────────────────┘
```

- Left (desktop 360px): thread of turns. Each turn = the host's words + the version thumbnails it produced (first Post turn shows 4). Selected version has a ring. Refine box docked at the bottom with suggestion chips and a Settings popover (size; quality / camera where relevant).
- Right: the selected version, large; version stepper; in-flight versions show the generating stage.
- Actions: Download, Publish, ⋯ (Post: Edit in Posts, Shuffle layout; Photo: Use in a post, Make a clip from this; all: Delete version, Copy improved description when present).
- Phones: preview first, version strip under it, thread in a "History" sheet, refine box docked above the bottom bar.

## 4. Data model

Migration `20261316128500_marketing_ai_sessions.sql`:

- `marketing_ai_sessions` — `id`, `organization_id`, `property_id`, `output` (`post|image|video`), `title`, `theme_key`, `created_by`, `created_at`, `updated_at`, `deleted_at`. Index `(property_id, deleted_at, updated_at DESC, id)`.
- `marketing_generation_jobs.session_id` (FK, `ON DELETE CASCADE`) + `parent_job_id`.
- `marketing_ai_post_versions` — `id`, `session_id` (cascade), `property_id`, `prompt`, `turn_id`, `goal`, `format`, `spec` JSONB, `preview_path`, `parent_version_id`, `created_at`.
- Backfill: one session per existing job (title from prompt).
- Service-role only (RLS on, no policies), same as the jobs table.

## 5. API

`marketing-ai-sessions` (new): GET list (keyset on `updated_at, id`; `output`, `q`, `deleted`), GET `?id=` (session + versions: jobs + post versions), POST create / `post-versions` (save rendered post versions; preview uploaded to Storage) / `restore`, PATCH rename, DELETE soft / permanent (permanent removes job outputs and post previews). Permission: view `marketing:view`; writes `marketing.generate:add` or the image / video leaf; delete any generate leaf. No plan gate on read / delete / rename (your own output).

`generate-marketing-media`: optional `sessionId` (must belong to the property and match the output) and `parentJobId` (image: the parent's output becomes the first reference; video: the parent's start frame is reused). Without `sessionId` a session is created from the prompt. Response adds `sessionId`.

`generate-marketing-template` poster: optional `revise: { spec, instruction }` → one revised variant.

Activity: `marketing.ai_session_deleted` / `_restored` (count). Rename and post-version saves are N/A (high-frequency editor state, not a host action); generations keep their own events.

## 6. Phases

1. Migration + `_shared/marketingAiSessions.ts` (+ Deno tests) + `marketing-ai-sessions` + generate-media session params + poster revise.
2. Client: API hooks, URL state (`session`, `output`), AI Studio home, 2-step new flow, workspace (desktop + phone).
3. Library frame: theme bar move, create strip + split button, toolbar + filter popover + chips (all four tabs).
4. Tests (unit, Deno, e2e), docs (route guide, PROJECT, data model, edge functions, runbook, plans matrix), ci.

## 7. Status

| Phase | Status                                                                                        |
| ----- | --------------------------------------------------------------------------------------------- |
| 1     | Done — migrations applied locally, `marketing-ai-sessions` + generate-media / poster `revise` |
| 2     | Done — hooks, URL state, AI Studio home, 2-step create, workspace (desktop + phone)           |
| 3     | Done — theme bar on the tab row, start row + split New button, shared toolbar on all 4 tabs   |
| 4     | Done — unit + Deno + e2e green, docs updated                                                  |

**Verified locally:** post batch → 4 versions → shuffle / resize / download / Edit in Posts, photo and clip validation paths, AI Studio home (fresh + returning, select, Recently deleted), library tabs at 1440 / 390. Migrations are applied to the **local** database only — not deployed to hosted dev or production.

**Known gaps:** the local stack has AI disabled (`generate-marketing-template` 503), so AI-directed posts and photo / clip generation were exercised through the mocked e2e path and the rule-based fallback, not against live models.
