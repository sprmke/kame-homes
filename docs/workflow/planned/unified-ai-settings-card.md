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

Hosts see **one AI card** in org settings and **one AI card** in property settings. Org owns the platform master switch (synced to every property). Feature configs nest inside the card with progressive disclosure.

## Shipped

- Org: `OrgAiSettingsSection.tsx` — **Enable AI for organization** (syncs `ai_platform_property_settings.enabled` for all properties via `syncPropertyAiEnabledForOrg`), then **Usage** + nested **Dashboard assistant** only when master is on
- Property: `PropertyAiSettingsSection.tsx` — no second master; inherits org enable (link to org settings when off); **Usage** + nested **Voice receptionist** when org AI is on
- Progressive disclosure: assistant/voice config and usage stats appear only when that feature toggle is on
- Nav + card title: **AI features** (shared labels in `aiSettingsLabels.ts`)
- Chrome: `AiSettingsChrome.tsx` — shared toggle row, usage stats (`text-sm font-semibold tabular-nums`), credits bar, feature group

## Out of scope

- Super-admin `/admin/ai` console layout
- Backend APIs and copy-settings group IDs (unchanged aside from org→property enable sync)
