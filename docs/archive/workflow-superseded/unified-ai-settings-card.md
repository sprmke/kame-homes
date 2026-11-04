---
title: Unified AI settings card
status: done
tags: [workflow, planned, ui, ai]
updated: 2026-09-27
stage: planned
kind: reference
---

# Unified AI settings card (org + property)

## Goal

Hosts see **one AI card**, in org settings only. Org owns the platform master switch (synced to every property) and every AI feature config. Feature configs nest inside the card with progressive disclosure.

## Shipped

- Org: `OrgAiSettingsSection.tsx` — **Enable AI for organization** (syncs `ai_platform_property_settings.enabled` for all properties via `syncPropertyAiEnabledForOrg`), then **Usage** + nested **Dashboard assistant** only when master is on
- Property: AI section **removed**. All AI config is org-level.
- Voice receptionist moved to org: `OrgVoiceReceptionistGroup.tsx` (enable, voice, Test voice, persona, per-property opt-out, usage). Table `ai_voice_receptionist_org_settings` (migration `20261316126200`, backfilled from property configs). Runtime resolves per property from the org row. Property leaves `settings.voiceReceptionist:edit` / `settings.aiOverrides:edit` retired; voice uses `org.settings.aiPlatform:edit`. Copy-settings `voiceReceptionist` / `aiOverrides` groups removed. `ai-platform-property-settings` is GET-only.
- Progressive disclosure: assistant/voice config and usage stats appear only when that feature toggle is on
- Nav + card title: **AI features** (shared labels in `aiSettingsLabels.ts`)
- Chrome: `AiSettingsChrome.tsx` — shared toggle row, usage stats (`text-sm font-semibold tabular-nums`), credits bar, feature group

## Out of scope

- Super-admin `/admin/ai` console layout
- Per-property voice session caps (stay super-admin, per property)
