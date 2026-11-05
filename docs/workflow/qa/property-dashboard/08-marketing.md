---
title: 'QA — Property Marketing'
status: active
updated: 2026-11-02
---

# 08 — Marketing

Route: `/org/:orgSlug/property/:propertySlug/marketing`

## AI Studio examples gallery (2026-11-02)

Scoped pass on the new **Start from an example** feature (AI Studio home + step 2). Full module re-walk not repeated; see the rest of this file for that.

**Checked (mocked RBAC harness + live Playwright, chromium, light + dark):**

- Gallery renders on both empty and returning home; filter persists per property; opening/stepping/closing an example never calls `generate-marketing-media` or `generate-marketing-template` (asserted via request interception).
- **Permission gating is correct and intentional, not a gap:** a post example's **Use this example** stays enabled under the **Operations** RBAC template, because post generation is gated on the text leaf `marketing.generate:add` (which Operations has), not the image/video leaves — this matches `docs/guides/routes/org/property/marketing.md`'s permission table and `useAiOutputAccess()` (`AiStudioHome.tsx`), which the example detail reuses verbatim (`access` prop, same `OUTPUT_FEATURE` map as the start cards). Photo/clip examples would correctly disable under Operations/Read Only via the same shared hook; not independently re-verified live because no photo/clip sample assets are shipped yet (see below), but the code path is identical to the already-covered start-card case in `marketingAiGenerate.spec.ts`.
- **Read Only** has no `marketing:view` leaf at all and never reaches the Marketing page — unrelated to this feature, confirmed from `propertyTeamRbacHarness.ts`, not a regression.
- Plan gating (`TierBadge`, Generate's upgrade modal) is inherited unchanged from the existing output-level gate; nothing new added here.
- Dark mode + `prefers-reduced-motion`: gallery re-renders cleanly on toggle, no layout break, no autoplay (`useCanAutoplay` returns false under reduced motion).
- Zero `.mp4` byte requests fire on initial page load (examples never eagerly fetch clip video; posters/images only) — the main LCP risk for the gallery.
- **Photo and clip examples are not currently visible** — `READY_SAMPLE_IDS` ships empty because the local Gemini key is free-tier (confirmed via a live `generate.ts` run: `Quota exceeded ... free_tier_requests, limit: 0`). Only post examples show (they render live through the real poster compiler, no pre-generated files needed). This is expected per the in-progress plan, not a bug — the **Photos** / **Clips** filter tabs correctly show nothing to filter rather than a broken or blank gallery, since there is nothing in those categories to list yet.

**Not run this pass:** a real authenticated local-stack walk with a seeded host login (would need magic-link injection + a seeded Business-plan property); full Lighthouse against the authenticated route (the project's own `lighthouse-routes.mjs` has the same limitation — unauthenticated Lighthouse on a host route only measures the sign-in redirect shell, not the real page, documented in that script's own comments).

## Looks good

- Content Studio (Calendar / Design / Video) is a major differentiator when entitled.
- Watermark / upgrade for `marketingStudio` (Pro+); Meta publish Business+.
- Telegram marketing alerts correctly live under Notifications (guide callout).
- **Phase 3 (Pro):** Design editor → **Download PNG** succeeded; **Publish** → Upgrade to Business.
- **Phase 4 (Business):** Publish dialog empty-state + Inbox deep-link; confirm **Publish** disabled until Meta channel connected.
- **AI Studio examples gallery:** permission/plan gating correctly reuses existing output-level gates; no eager video network cost; renders cleanly in dark mode and under reduced motion.

## Issues

| Sev | Issue                                                                                           | Evidence           |
| --- | ----------------------------------------------------------------------------------------------- | ------------------ |
| P1  | Rapid page walk hit **429** on `marketing-templates` / `publish-to-meta` — fragile under reload | Playwright console |
| P2  | `get-public-property` **400** while Marketing loads property media — preview may fail locally   | Console            |
| P2  | Free/Starter hosts open Marketing but mostly watermarked — feels like a locked showroom         | Host lens + matrix |
| P3  | Editor complexity vs day-to-day host time (CapCut-like video)                                   | Critique           |

## Improvements

- Soften empty/error when public property fetch fails (don’t spam console).
- One-click “Generate this week’s availability story” from Dashboard (AI promise).

## Doc gaps

- Guide very long but accurate; keep Meta publish Business+ note.

## Evidence

Live Marketing title; Phase 3 download + Publish gate; Phase 4 Business publish empty-state; console 429/400; `planFeatures` / matrix.
