---
title: 'Explore guest support tickets'
status: active
tags: [workflow, done, guest, help-support]
updated: 2026-08-27
stage: done
kind: reference
---

# Explore guest support tickets (shipped)

Public **Contact** category cards require **explore** auth (not host dashboard login), then open the same **`NewTicketModal`**. Guest account **Tickets** (`/account/tickets`) reuses dashboard ticket list/thread UI.

## Shipped (2026-08-27)

| Area        | Change                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **DB**      | `support_tickets.channel` (`host` \| `guest`); `organization_id` nullable for guest; messages `sender_type` includes `guest` |
| **Edge**    | Guest channel when no org/property/parking scope; admin list/detail left-join orgs                                           |
| **Contact** | `requireGuestAuth` + `GuestAuthModal`; modal always guest-scoped                                                             |
| **Account** | Nav **Tickets** + `GuestTicketsPage` wrapping `TicketsWorkspacePage`                                                         |

## Local

```bash
bun run db:migrate
# Contact: /contact → category → sign in → modal → /account/tickets/:id
```
