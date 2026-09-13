---
title: 'Guest booking document (token-gated GAF/Pet PDF)'
status: active
tags: [guides, routes]
updated: 2026-08-22
---

# Guest booking document (token-gated GAF/Pet PDF)

Route: `/properties/:propertySlug/document?token=<opaque>&doc=gaf|pet`

> **Status:** Documented

## Purpose

Redirect-only page: resolves a durable, guest-safe share token to a fresh signed Storage URL for one of a booking's private approved-document PDFs (**Approved GAF** or **Approved Pet Form**), then `window.location.replace()`s to it. No content of its own renders beyond a loading skeleton — mirrors [[stay-guide|Guest stay guide]]'s token-gated pattern but with no rendered brochure and no stay-dated validity window. It renders outside every app shell (no `MainLayout`/`MarketingLayoutShell`, no bottom nav) — deliberately, since the guest never lingers here. **2026-09-10:** its two states (unavailable message, loading skeleton) previously used hardcoded hex colors instead of semantic tokens; fixed to `bg-background`/`text-foreground`/`border-border`/`bg-muted` for theme consistency.

Shared from the **Guest Inbox** composer's Share picker (see [[inbox|Property Guest Inbox]] → Behavior → Share resources) or, in future, the booking Files tab.

## Access

| Rule       | Detail                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Token**  | Opaque `document_share_token` on `guest_submissions`; one token unlocks both GAF and Pet docs for its booking, issued on demand       |
| **Window** | None — unlike Stay Guide, not gated to the stay dates. Approval proof is shareable any time the document exists                       |
| **Guard**  | Booking must not be `CANCELLED`; the requested `doc`'s URL column (`approved_gaf_pdf_url` / `approved_pet_pdf_url`) must be non-empty |
| **Slug**   | API accepts optional `?property=`; must match the booking's property when provided                                                    |

Invalid/expired/mismatched token → generic "This link is not available." (no leak of booking existence) — same guard as Stay Guide.

## Why a token instead of the signed URL directly

The two source PDFs live in **private** Storage buckets (`approved-gafs`, `approved-pet-forms`). The only prior resolver (`get-booking-asset-url`) is admin-JWT-gated and mints a **30-minute** signed URL — unusable for a link pasted into a chat message a guest may open hours or days later. This route's token is durable; `get-guest-booking-document` mints a **fresh** signed URL (30-minute TTL) server-side on every visit, so the shared link keeps working indefinitely even though each individual signed URL expires.

## API

| Function                             | Method | Auth                      | Query                                                             |
| ------------------------------------ | ------ | ------------------------- | ----------------------------------------------------------------- |
| `issue-booking-document-share-token` | POST   | JWT + `bookings:workflow` | `{ bookingId }` — issues or reuses the token                      |
| `get-guest-booking-document`         | GET    | anon                      | `?token=` + `?doc=gaf\|pet` required; `?property=<slug>` optional |

## Implementation map

| Layer            | Path                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Page             | `ui/src/features/guest/booking-documents/pages/GuestBookingDocumentPage.tsx`                                                   |
| Fetch client     | `ui/src/features/guest/booking-documents/lib/api.ts`                                                                           |
| Path builder     | `ui/src/features/guest/lib/guestPublicPaths.ts#guestBookingDocumentPath`                                                       |
| Route            | `ui/src/features/guest/property/routes/index.tsx` — top-level, same tier as `stay-guide`                                       |
| Token + resolver | `supabase/functions/_shared/bookingDocumentShareToken.ts` (`ensureBookingDocumentShareToken`, `resolveBookingDocumentByToken`) |
| Issue edge       | `supabase/functions/issue-booking-document-share-token/index.ts`                                                               |
| Resolve edge     | `supabase/functions/get-guest-booking-document/index.ts`                                                                       |
| Admin hook       | `ui/src/features/dashboard/bookings/hooks/useBookingDocumentShareLink.ts`                                                      |
| Migration        | `supabase/migrations/20261102130000_booking_document_share_token.sql`                                                          |

---

## Testing

| Layer | Path / spec                               | Manual          |
| ----- | ----------------------------------------- | --------------- |
| Unit  | guest document token allow-list when pure | —               |
| N/A   | Signed URL redirect                       | Manual token QA |

## Related

- [[stay-guide|Guest stay guide]] — the precedented token pattern this mirrors
- [[inbox|Property Guest Inbox]] — where hosts issue and send these links
