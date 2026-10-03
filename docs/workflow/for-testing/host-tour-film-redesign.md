---
title: 'Host tour film redesign'
status: active
tags: [workflow, for-testing, marketing, for-hosts]
updated: 2026-10-03
stage: for-testing
kind: plan
---

# Host tour film redesign

Ground-up rebuild of the narrated Remotion product tour on `/for-hosts` (and `/for-hosts/preview`, `/for-hosts/login`, `/for-guests/login`, onboarding side panel).

## Why

1. **Coverage gaps.** The 19-chapter film predates Analytics, Smart Pricing, AI Studio (AI Post, Photo, Video generation), AI Mode, the Setup Guide and Announcements.
2. **Fidelity drift.** The film shell invents chrome the app does not have (top bar with "All systems synced", "Automation live" card, tinted active nav + chevron, in-scene teal eyebrow + H2). The real shell: `bg-sidebar` rail with tenant scope on top, a **solid `bg-primary` active pill**, Setup Guide entry + account footer, no desktop top bar, and a page header (`text-admin-page-title`) above token-based cards. Property nav now has **Analytics** and no **Plans & Billing** (billing is org-only); org nav has **Analytics** and **Announcements**.
3. **Narration** is long and dense (25 to 30 words per line). It should be short, plain, one idea per line.

## Direction (from leading SaaS product films: Linear, Stripe, Notion)

- Product on screen in the first seconds; a 4s hook card, then straight into the UI.
- **One idea per scene**, ~5 to 7s each, paced to the voice line.
- **Captions carry the story.** The tour autoplays muted, so every scene gets a large kinetic caption (2 to 6 words) as a lower-third over the UI. Narration repeats it in plain words.
- **Camera focus.** Each scene opens on the full screen, then eases into the area that matters and holds still (one eased scale/translate per scene, settles, no per-frame jitter).
- Cursor + click ring for every action; highlight ring on the element being explained.
- Calm, minimal, tokenized: real app color tokens (`bg-card`, `bg-sidebar`, `bg-primary`, `border-border`, `text-muted-foreground`, `shadow-card`) so the film tracks the design system and dark mode automatically. No breakpoint-bearing shared classes (`.surface-card` goes borderless under `max-lg`; the Player is scaled, so viewport media queries would restyle the film on phones).
- Closing card with brand + **Start free**.

## Chapter list (24, ~2:30)

| #   | id               | Caption                      | Narration (plain, short)                                                                         |
| --- | ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| 0   | intro            | Your rentals, run for you    | Meet Kame Homes. Everything you need to run your rentals, in one place.                          |
| 1   | setup-guide      | Set up in minutes            | Setup takes minutes. A guided checklist walks you through every step.                            |
| 2   | portfolio        | Every listing, one view      | See all your properties and parking spots together, with revenue and occupancy.                  |
| 3   | command-center   | Your day at a glance         | Each property gets a simple home page: earnings, your calendar, and what needs you today.        |
| 4   | booking-workflow | Bookings that run themselves | Bookings move forward on their own. Documents, receipts, and guest emails are handled for you.   |
| 5   | bookings-board   | Drag, drop, done             | Prefer a board? Drag a booking to its next step, or add one by hand.                             |
| 6   | data-import      | Import with AI               | Moving from a spreadsheet? Upload it, and AI fills in the right fields.                          |
| 7   | channel-sync     | Synced with Airbnb           | Connect Airbnb once. Bookings and blocked dates stay in sync both ways.                          |
| 8   | pricing          | Smart Pricing                | Set your rates on a calendar, or turn on Smart Pricing and let AI suggest them.                  |
| 9   | finance          | Know your profit             | Income is recorded automatically. Add expenses and see your real profit.                         |
| 10  | maintenance      | Upkeep on schedule           | Schedule upkeep, get reminders, and check off tasks as you go.                                   |
| 11  | analytics        | Insights, explained          | Analytics shows how you are doing, and an AI review tells you what to improve.                   |
| 12  | guest-inbox      | One inbox, AI replies        | Facebook, Instagram, and website chat land in one inbox. AI drafts the replies.                  |
| 13  | ai-receptionist  | An AI receptionist           | Guests can call Kame, your AI receptionist. It answers questions about your place, day or night. |
| 14  | public-pages     | Pages that sell              | Your listing, stay guide, and showcase page update live as you edit.                             |
| 15  | templates        | Emails in your voice         | Customize every guest email, and preview exactly what guests will see.                           |
| 16  | marketing-studio | Content Studio               | Content Studio makes calendars, social posts, and short videos for your property.                |
| 17  | ai-photo         | AI photos and posts          | Describe a shot, add your photos, and AI creates posts and images that look like your place.     |
| 18  | ai-video         | AI video                     | Pick a photo and a camera move. AI turns it into a short video clip.                             |
| 19  | team             | Your team, your rules        | Invite your team, and choose exactly what each person can see and do.                            |
| 20  | notifications    | Alerts in Telegram           | Get instant Telegram alerts for bookings, messages, and maintenance.                             |
| 21  | ai-mode          | Just ask                     | Switch to AI mode, ask in plain words, and the right page opens beside the chat.                 |
| 22  | plans-billing    | Simple pricing               | Simple plans, priced per property, with one bill for your whole organization.                    |
| 23  | outro            | Start free today             | Kame Homes. Less busywork, more happy guests. Start free today.                                  |

Help & Support folds into the outro line-up (it is a support surface, not a selling point); Announcements appear in the org sidebar.

Chapter length = narration audio length + ~1.4s (start delay + breathing room), rounded to whole frames, measured with `ffprobe` after generation.

## Guest-side chapters (added 2026-10-03)

After `public-pages`: **guest-booking** (search → listing → date picker → Reserve → guest form steps) and **guest-journey** (stay guide · web chat + Talk to receptionist · review → voucher). Tour is now 26 chapters (~2m 52s).

## Implementation

- `film/FilmShell.tsx`: rebuilt to the real shell (tenant scope, primary pill, Setup Guide entry, account footer, current nav per context, page header).
- `film/FilmPrimitives.tsx`: keep monotonic motion helpers; add `CameraFocus`, `SceneCaption`, `TitleCard`, token-based `Card` / `CardHeader` / `Kpi` / `Chip` / `Btn`; keep `Cursor`, charts, calendar.
- `film/scenes/`: replace `SceneAct1–5` with `SceneBookends`, `SceneStart`, `SceneBookings`, `SceneMoney`, `SceneGuests`, `SceneMarketing`, `SceneTeam`; `filmScenes` keyed by chapter id (not index).
- `data/hostTourChapters.ts` + `hostTourNarration.ts`: new list, `caption`, `bookend` flag.
- `HostDashboardTourPlayer`: chapter strip skips bookends; everything else unchanged (marketing + compact variants).
- Regenerate narration MP3/VTT with `scripts/marketing/generate-host-tour-narration.ts`; delete orphan files.
- Copy: `VideoTourSection`, `HostDashboardTour`, `preview/data/hostShowcase.ts` ("19 features").
- Docs: `docs/guides/routes/for-hosts.md`.

**Plans / RBAC:** N/A (public marketing). **activity-log:** N/A (no writes).

## Verify

`bun run type-check`, `lint`, `check:filenames`, `build`; Playwright screenshots of each chapter in light + dark at 1440 and 375 widths; compact player on `/for-hosts/login`.

## QA checklist

- [ ] `/for-hosts`: tour autoplays muted; every strip chip jumps to its chapter; captions readable at 1440px.
- [ ] Unmute: each line plays once, no overlap, no cut-off at chapter end.
- [ ] Dark mode (system dark): shell, cards, captions, dialogs readable.
- [ ] `/for-hosts/login` and onboarding side panel: compact player plays, expand dialog stays in sync.
- [ ] 375px phone: player fits, no horizontal scroll.
- [ ] Reduced motion: no autoplay, chapters hold on a still frame.
