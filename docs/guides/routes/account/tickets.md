---
title: 'Guest account — Tickets'
status: active
tags: [guides, routes, account, help-support]
updated: 2026-08-27
---

# Guest account — Tickets

Route: `/account/tickets` (+ `?compose=1`, legacy `/new`, `/:ticketId`)

> **Status:** Documented — explore-mode tickets (same UI as dashboard Help & Support Tickets).

## Progress overview

| Section     | E2E save | Validation | Docs       | Notes                                                    |
| ----------- | -------- | ---------- | ---------- | -------------------------------------------------------- |
| Tickets hub | ✅       | Server     | Documented | Reuses `TicketsWorkspacePage` + `NewTicketModal`         |
| Contact CTA | ✅       | Auth       | Documented | `/contact` category cards → guest auth → same modal form |

---

## Overview

Signed-in explore guests open **Tickets** from the account menu (avatar) or sidebar. Layout matches dashboard **My Tickets**: list + thread split on desktop, one pane on phone, **New** compose modal. Tickets filed from public **Contact** (`/contact`) land here after submit.

Host org tickets (Help & Support in the dashboard) stay separate (`channel=host`). Explore tickets use `channel=guest` with no organization.

---

## Host-facing knowledge

Guests can message Kame from the public Contact page after signing in with their explore account. Those tickets show under the guest’s **Tickets** menu, not under your property Help & Support.

**Common host questions**

- Q: Will a guest’s Contact ticket appear in my org Help & Support?
  A: No. Explore Contact tickets are guest-channel. Super-admins still see them on `/admin/support` labeled Explore guest.
- Q: Can hosts still file tickets from the dashboard?
  A: Yes — Help & Support → Tickets is unchanged and stays org-scoped.

---

## Behavior

- Auth: `RequireGuestSession` (same as Profile / Stays / Favorites).
- Scope: `SupportTicketScopeProvider` with `channel: 'guest'` (no org/property/parking).
- UI: `TicketsWorkspacePage` with `basePathOverride={GUEST_ACCOUNT_PATH}` (`/account`). **New** sets `?compose=1` on the tickets URL; legacy `/account/tickets/new` redirects to the same.
- APIs: `list-support-tickets`, `get-support-ticket`, `submit-support-ticket`, `reply-support-ticket`, `reopen-support-ticket`, `upload-support-ticket-attachment` (guest channel when no org params).
- DB: `support_tickets.channel = 'guest'`, `organization_id` null; messages `sender_type = 'guest'`.
- **Closed** tickets hide the composer; **Reopen ticket** calls `reopen-support-ticket` then restores replies. **Resolved** tickets keep the composer; replying moves status to **In progress**.

### Contact (`/contact`)

1. Guest picks Broken / Idea / Question / Business.
2. If signed out → **`GuestAuthModal`** (same as Reserve / Contact host on listings).
3. If signed in → same **`NewTicketModal`** / **`TicketComposeForm`** as dashboard.
4. After submit → `/account/tickets/:ticketId`.

---

## Implementation map

| Concern        | Path                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| Page           | `ui/src/features/guest/account/pages/GuestTicketsPage.tsx`                   |
| Nav            | `guestAccountNav.ts` · `GuestAccountMenu` · `GuestAccountSidebar`            |
| Contact        | `ui/src/features/guest/marketing/pages/ContactPage.tsx` · `GuestAuthContext` |
| Shared tickets | `ui/src/features/dashboard/help-support/pages/TicketsWorkspacePage.tsx`      |
| Migration      | `supabase/migrations/20261204120000_guest_support_tickets.sql`               |

---

## Testing

| Layer | Path / spec      | Manual                          |
| ----- | ---------------- | ------------------------------- |
| N/A   | Guest tickets UI | Manual when triage flow changes |

---

## Related docs

- [Account profile / shell](./profile.md)
- [Legal / Contact](../legal.md)
- [Property Help & Support](../org/property/help-support.md)
- [Admin support](../admin/support.md)
