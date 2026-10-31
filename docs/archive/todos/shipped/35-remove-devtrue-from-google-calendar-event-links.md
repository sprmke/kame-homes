---
title: '[4.7] Remove dev=true from Google Calendar event links'
status: archived
tags: [todos, shipped, calendar]
updated: 2026-08-02
---

# [4.7] Remove `dev=true` from Google Calendar event links

|             |                                                       |
| ----------- | ----------------------------------------------------- |
| **GitHub**  | [#35](https://github.com/sprmke/kame-homes/issues/35) |
| **Shipped** | 2026-07-28                                            |
| **Labels**  | module:integrations, priority:p1, type:security       |

## Description

~~Stop appending `dev=true` (or legacy test params) to calendar summary links shown to guests/operators.~~

New goal: We should remove these dev and other query parameter that we have from dashboard, public guest form, and all places of our app

## Shipped notes

Removed `?dev=true` / `testing` / submit-form control flags from guest & calendar URLs (strip on load). Guest API toggles are non-prod only via FormData; hosted submit-form forces full side effects. Calendar admin links already clean `/bookings/{id}`.
