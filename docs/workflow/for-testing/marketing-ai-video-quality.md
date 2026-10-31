---
title: 'Marketing AI video: quality pass and production readiness'
status: for-testing
tags: [marketing, ai, video-generation, veo, production-readiness]
updated: 2026-10-02
stage: for-testing
kind: plan
---

# Marketing AI video: quality pass and production readiness

Goal: Generate tab videos a host can post to Reels / Stories without editing, at the bar set by
Higgsfield-style apps, with the same guardrails as the image hardening
([`marketing-ai-image-quality-hardening.md`](../in-progress/marketing-ai-image-quality-hardening.md)).

Route guide: [`org/property/marketing.md`](../../guides/routes/org/property/marketing.md) (Generate tab, **Video direction**, **Video output validation**).

## Audit findings (before this pass)

Checked against the live Veo REST API on 2026-10-01 with requests that are invalid on purpose
(validation runs before billing, so these cost nothing).

| #   | Finding                                                                                                                                                                                             | Impact                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `durationSeconds` sent as a string. Veo rejects it: the field must be a JSON number.                                                                                                                | **Every video request failed.**                          |
| 2   | Reference images sent as `inlineData`. Veo only accepts `{ bytesBase64Encoded, mimeType }` (the docs' REST samples are stale).                                                                      | Every request with a photo failed.                       |
| 3   | `personGeneration: 'allow_adult'` on text-to-video. Text-to-video only accepts `allow_all`.                                                                                                         | Every request without a photo failed.                    |
| 4   | Photos sent as asset `referenceImages` (meant for a person or product). Veo Lite (Draft) rejects them outright, and on Fast they only guide style, so the clip did not show the host's actual room. | Draft + photo always failed; others looked generic.      |
| 5   | 1080p and reference images require 8s; the composer offered 6s with both.                                                                                                                           | Valid-looking combinations the API refused.              |
| 6   | Price table: Standard 1080p billed at $0.30/s (Google: $0.12/s), Premium 1080p at $0.60/s (Google: $0.40/s).                                                                                        | Hosts over-charged 2.5x / 1.5x.                          |
| 7   | Prompt sent verbatim: no camera language, no "keep the room as photographed", no audio direction. Veo always renders audio and, unprompted, tends to add mumbled voices.                            | Generic motion, invented furniture, speech in the audio. |
| 8   | No output validation: whatever Google returned was stored and billed.                                                                                                                               | A truncated or wrong-shape clip would be charged.        |
| 9   | Raw safety-filter reasons dropped.                                                                                                                                                                  | Blocks could not be diagnosed.                           |

What was already solid and is kept: async submit + poll + `pg_cron` sweeper with CAS claim,
billing claimed before `recordAiUsage`, credit reservation from job status, concurrency caps
(2 per property, 5 per org), rate limit (5 video / 5 min per user), per-feature sub-cap, 45 min
TTL, failures not charged.

## Decisions

1. **Image-to-video, one photo.** The host's photo is sent as Veo's `image` (first frame), so
   the clip starts on the real listing. Asset `referenceImages` are dropped. One photo max on
   every tier (`maxStartFrames: 1`). JPEG / PNG / WebP only (Veo); the picker leaves HEIC out
   of `accept` so iOS converts on pick.
2. **8 seconds only, 1080p default.** 1080p and start frames need 8s, and Reels want 5-90s.
   Draft (Lite) is 720p only. No 4K: Meta re-encodes Reels to 1080 wide, so 4K costs 2.5x
   more and posts the same.
3. **Camera move presets** (Higgsfield-style): Push in (default), Pull back, Pan, Orbit, Rise,
   Walkthrough, Still. Each is a tested real-estate videography direction with short travel,
   because long travel forces Veo to invent rooms it has never seen.
4. **Sound mode:** Ambient (default) or Music. Speech, voiceover, and singing are always ruled
   out in the prompt and the negative prompt.
5. **Vision-grounded rewrite, fail-open.** One `gemini-3.1-flash-lite` call
   (`marketing_video_prompt_enhance`, platform cost, cached, 10s) sees the start frame and
   writes one shot description that only moves things actually in the photo. Verified live:
   for a living-room photo it named the leather sofa, white armchairs and plants; for a 9:16
   crop of the same photo it switched to the coffee table and gallery wall (the sofa was
   cropped out). Off or failed: a deterministic sentence from the same parts.
6. **Guardrail tail in code, never in the LLM.** Style, platform framing, fidelity rule, text
   ban, and audio rule are appended after the rewrite, so the model cannot drop them. Base
   `negativePrompt` (text, warping, morphing, flicker, cuts, talking; plus people / faces /
   hands with a start frame) with the host's words appended.
7. **Description optional with a photo.** The server sends `Bring this photo to life`;
   Edit and retry shows an empty box again.
8. **Look hidden when a video starts from a photo.** The photo sets the light; a look
   ("blue hour") would fight the first frame.
9. **MP4 probe before billing.** Box-header reader, no dependency. Rejects only on positive
   evidence (under 50 KB, no video track, more than 1.5s short, wrong orientation). Unreadable
   and fragmented layouts pass.
10. **Options stored** in `marketing_generation_jobs.generation_options` (JSONB object) so
    "Use these settings" restores camera and sound.
11. **No seed control.** Veo accepts `seed`, but it does not make reruns match closely enough
    to be worth a control.
12. **No pre-crop of landscape photos.** The photo goes to Veo as uploaded. A center crop to
    9:16 can cut out the room's main subject, while the vision rewrite already describes what
    is actually in frame. The live evaluation below confirms or reverses this.
13. **Platform absorbs rejected clips.** When the MP4 check rejects a clip (`invalid_output`),
    the host is not charged, but Google has billed the render, so the cost is recorded
    platform-only (0 credits) and shows in the super-admin console spend.
14. **Monitoring lives in the super-admin AI console only** (`/admin/ai?tab=usage`), never on
    host screens: credits and spend for every AI feature, usage by plan against each plan's
    credit allowance, and Marketing Studio job outcomes (success rate, failed, blocked, render
    time, failure reasons, unbilled jobs). Read-only; limits stay on the Limits / Profiles tabs.
15. **Not adopted now: Gemini Omni Flash** (`gemini-omni-1.1-flash`, ~$0.10/s 720p, 1080p is an
    upscale, no negative prompt or system instruction). Revisit behind the model router if it
    adds native 1080p.

Plans / RBAC: **N/A, no new key or leaf.** Rides `aiMarketingVideoGeneration` (Business+) and
`marketing.generate.video:add`. Activity log: existing `marketing.video_generation_started`
gains `start_frame`, `camera_move`, `sound`, `prompt_enhanced` metadata; no new action.
Assistant parity: no new edge function or capability.

## Pricing after this pass (8s clip)

| Tier            | 720p                | 1080p                    |
| --------------- | ------------------- | ------------------------ |
| Draft (Lite)    | 400 credits ($0.40) | n/a                      |
| Standard (Fast) | 800 ($0.80)         | **960 ($0.96)**, default |
| Premium (3.1)   | 3,200 ($3.20)       | 3,200 ($3.20)            |

## Status

| Phase                                                                                                                                                                                                                                                                                                          | State                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request shape (`buildVeoRequestBody`), constraint matrix, pricing                                                                                                                                                                                                                                              | Done, unit-tested                                                                                                                                        |
| Prompt builder (camera, sound, tail, negative, vision rewrite)                                                                                                                                                                                                                                                 | Done, unit-tested; rewrite verified live                                                                                                                 |
| MP4 probe in finalize                                                                                                                                                                                                                                                                                          | Done; checked against real ffmpeg output (faststart, non-faststart, fragmented, audio/none)                                                              |
| Handler + `generation_options` migration + DTO                                                                                                                                                                                                                                                                 | Done                                                                                                                                                     |
| Composer (Camera, Sound, Start from a photo, Auto-improve, no Length)                                                                                                                                                                                                                                          | Done; E2E + 375/768px screenshots, no horizontal overflow                                                                                                |
| Platform cost for rejected clips, `invalid_output` code                                                                                                                                                                                                                                                        | Done                                                                                                                                                     |
| Super-admin monitoring (credits, usage by plan, Marketing Studio jobs)                                                                                                                                                                                                                                         | Done; `aiUsageConsoleSummary_test.ts` + `adminAiConsole.spec.ts`, 375 / 1280px screenshots                                                               |
| Review fixes (2026-10-02): budget re-checked right before the job insert (the photo read and rewrite widened the reservation race), console totals moved to SQL rollups (PostgREST's 1000-row cap undercounted busy ranges), unbilled uses `credits_consumed IS NULL`, shared feature labels with a drift test | Done                                                                                                                                                     |
| Migrations (`20261316126600`, `20261316126700`)                                                                                                                                                                                                                                                                | Applied locally. Hosted dev / prod ship with the normal deploy                                                                                           |
| **Paid live render**                                                                                                                                                                                                                                                                                           | **Manual test, waiting on Veo billing:** every Gemini key in `supabase/.env.local` still returns 429 quota on all Veo 3.1 models (re-checked 2026-10-02) |

## For testing

Code scope is closed. Only this manual check remains before `done/`:

1. Enable Veo billing on one Gemini key (Google AI Studio, Billing) or add a paid key.
2. Run the evaluation below. If cropped first frames clearly win, revisit decision 12.

## Evaluation protocol (needs a funded key)

Script used for the blocked run: submit through the real modules (`buildVeoRequestBody`,
`enhanceMarketingVideoPrompt`), download, probe, extract start / middle / end frames with
ffmpeg.

1. Same living-room photo, 9:16, Standard 1080p: (A) old path, text only, verbatim prompt;
   (B) new path, uncropped landscape first frame; (C) new path, 9:16 center-cropped first frame.
2. Score each clip 1-5 on: room fidelity (no new or morphing furniture), motion quality
   (smooth, no warping), framing for Reels, audio (no speech), postable without edits.
3. Then 10 real listing photos x 3 camera moves on Standard 1080p (~$29). Pass bar: median 4+
   on fidelity and postable, zero clips with speech or on-screen text.
