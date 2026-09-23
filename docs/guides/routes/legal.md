---
title: 'Legal & company pages — operator guide'
status: active
tags: [guides, routes]
updated: 2026-09-23
---

# Legal & company pages — operator guide

Routes: `/terms` · `/privacy` · `/cookies` · `/about` · `/contact` · `/support`

> **Status:** Documented — static public pages with product-grounded copy (not PMA placeholders).

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                                                          |
| ---------------- | -------- | ---------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Terms of Service | —        | —          | Documented | Grounded in booking workflow + PH law                                                          |
| Privacy Policy   | —        | —          | Documented | Guest/host PII + named processors                                                              |
| Cookie Policy    | —        | —          | Documented | Auth/session + prefs; PostHog when enabled; no ad pixels                                       |
| About            | —        | —          | Documented | Product capabilities; no fabricated history                                                    |
| Contact          | Yes      | Yes        | Documented | Explore guest auth + ticket modal; guest Tickets under `/account/tickets`                      |
| Support          | —        | —          | Documented | Guest + host FAQ                                                                               |
| Mobile shell     | —        | —          | Documented | `MarketingLayoutShell` bottom tabs — see [index-landing.md](./index-landing.md) § Mobile shell |

---

## Overview

Footer links from **`MarketingFooter`**. Legal pages use **`LegalSimplePage`** (shared **`MarketingPublicPageHero`** with About / Contact / Support). Operating brand: **Kame Homes**; guest fallback **hello@kamehomes.com**.

Footer **Pricing** points to **`/for-hosts/pricing`**. Careers, Blog, and Host Resources were removed from the footer (no backing content).

---

## Host-facing knowledge

These public pages explain the company, how to reach support, common guest/host questions, and the legal rules for using Kame Homes. Guests and hosts see the same pages; there is nothing to configure in the dashboard.

**Common host questions**

- Q: Can I edit the terms or privacy text from my dashboard?
  A: Not today. The copy lives in the app, so changes need a product update. Have a lawyer review before a major marketing launch.
- Q: Do guests have to accept these before booking?
  A: Not on a separate checkbox step; the pages are available from the footer.
- Q: Are my verification documents covered by the privacy policy?
  A: Yes. The policy describes host verification uploads and how they're stored privately.
- Q: Where do guests go for help?
  A: Support (`/support`) for FAQs, or Contact (`/contact`) — signed-in explore guests open a ticket (same form as Help & Support); stay questions can also email hello@kamehomes.com.

---

## Behavior

- All routes render inside **`MarketingLayoutShell`** (nav + footer).
- Shared hero band: **`MarketingPublicPageHero`** (centered eyebrow / title / description by default) + body via **`MarketingPublicPageContent`**. Company pages reuse **`MarketingPublicSectionHeading`**, **`MarketingPublicIconCard`**, **`MarketingPublicCallout`**, and **`MarketingPublicFaqList`** for consistent spacing and typography. Legal / Support / Pricing use **`narrow`** on both hero and content so title and body share one **centered** reading column (`mx-auto max-w-3xl`). Legal pages use **`LegalSimplePage`** (divided sections, left hero blob).
- Content is hard-coded in page components; no CMS.
- **Contact** (`/contact`) — four ticket categories (**Broken**, **Idea**, **Question**, **Business**) matching Help & Support. Clicking a category runs **`requireGuestAuth`** → **`GuestAuthModal`** (same as Reserve / Contact host on listings), then opens the same **`NewTicketModal`**. OAuth return uses `?category=` (+ optional `?subject=`). Deep links: Managed plan from **`/for-hosts/pricing`**. After submit → **`/account/tickets/:ticketId`**. Org-scoped host tickets remain under dashboard Help & Support. Guests also see Support + mailto fallback below the categories.
- Privacy states that Gemini processes live microphone audio, the platform does not store raw
  audio, unverified captions default to 30-day retention (configurable from 1 to 90 days), and the
  guest can delete captions after the call. Caption deletion also clears derived safety flags;
  timing, outcome, model, and estimated usage remain with account/property operational records.
- Cookie policy states current footprint: Supabase Auth session storage, UI preferences (e.g. theme); no analytics/ad-tracking scripts on these surfaces.

---

## Implementation map

| Concern | Path                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| About   | `ui/src/features/guest/marketing/pages/AboutPage.tsx`                                                                                                                                                                                         |
| Contact | `ui/src/features/guest/marketing/pages/ContactPage.tsx` · `marketing/contact/components/*` · reuses `NewTicketModal` + `submit-support-ticket`                                                                                                |
| Support | `ui/src/features/guest/marketing/pages/SupportPage.tsx`                                                                                                                                                                                       |
| Terms   | `ui/src/features/guest/marketing/pages/TermsPage.tsx`                                                                                                                                                                                         |
| Privacy | `ui/src/features/guest/marketing/pages/PrivacyPage.tsx`                                                                                                                                                                                       |
| Cookies | `ui/src/features/guest/marketing/pages/CookiesPage.tsx`                                                                                                                                                                                       |
| Layout  | `MarketingPublicPageHero` · `MarketingPublicPageContent` · `MarketingPublicSectionHeading` · `MarketingPublicIconCard` · `MarketingPublicCallout` · `MarketingPublicFaqList` · `LegalSimplePage` · `MarketingLayoutShell` · `MarketingFooter` |
| Routes  | `ui/src/features/guest/marketing/routes/index.tsx`                                                                                                                                                                                            |
| Hash    | Legacy **`/for-hosts#pricing`** redirects to **`/for-hosts/pricing`** in `MarketingLayoutShell`                                                                                                                                               |

---

## Related docs

- [Route index](./README.md)
- [Architecture routing](../../architecture/routing.md)

---

## Pending / follow-ups

- [ ] Legal counsel review before production marketing launch
- [ ] Replace placeholder phone / social URLs when real accounts exist
- [ ] Optional CMS or markdown source for policy updates
