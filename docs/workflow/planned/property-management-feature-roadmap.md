---
stage: planned
title: 'Property Management Feature Roadmap — Competitive Research'
status: planned
tags: [planning, planned-modules, roadmap, research, sales]
updated: 2026-09-14
---

# Property Management Feature Roadmap — Competitive Research

**Status:** Idea backlog from competitive research, not an implementation plan for any single item. Each feature below should get its own focused plan in `docs/workflow/planned/` before implementation — same pattern as [`ai-opportunities-roadmap.md`](./ai-opportunities-roadmap.md), which this doc complements (that one is an internal AI-idea sweep across our own surfaces; this one is benchmarked against what Guesty/Hostaway/Lodgify/Hospitable/OwnerRez and adjacent point solutions actually ship today).

## Purpose & how to use this doc

Built to answer: "what could we tell prospective clients we're building next, to look competitive with the big vacation-rental PMS players?" It is a **sales-conversation prep + engineering backlog seed**, not a committed roadmap — nothing here is scheduled. Pick items from the "Recommended near-term picks" section when ready to write a real spec.

Each feature is tagged with a tier:

- 🟢 **Quick Win** — extends an existing module/skill/edge function with no new external vendor; a few days to ~2 weeks.
- 🟡 **Mid-Term** — new module, or a new external integration (a vendor API, a webhook partner) layered on existing infra; multi-week.
- 🔴 **Big Bet** — new vertical capability, new compliance/financial surface, or multiple vendor integrations; multi-month, likely needs its own dedicated plan phases.

## What we already have (cross-checked so nothing below duplicates it)

- **Booking workflow**: full status machine with orchestrated side effects, AI receipt validation (Gemini vision) on submit, GAF/pet approval via inbound-email webhook, SD-refund cron, Airbnb two-way iCal sync (inbound blocks + OTA import).
- **Multi-tenancy**: org → property/parking hierarchy, granular JSONB permission catalog, Plans/entitlements (Free → Managed) with server-enforced gates everywhere.
- **Guest-facing**: booking form + calendar, guest portal, Stay Guide, marketing landing pages (6 templates, AI content), pay-parking marketplace with PayMongo, web chat widget, guest review/voucher system.
- **Admin modules**: Bookings, Finance, Maintenance, Pricing + Smart Pricing (deterministic engine + optional Gemini rationale/autopilot), Guest Inbox (Meta, unified threads), Team RBAC, Analytics (occupancy/ADR/RevPAR, YoY, platform-median benchmarking), Notifications, Marketing Studio (AI caption/image/video generation), Activity/Audit log, Super Admin console.
- **AI already shipped**: receipt/payment validation, AI Dashboard Assistant (99 tools, tiered auto-execute/confirm), AI inbox suggest/auto-reply, AI marketing content/image/video gen, AI CSV import mapping, Smart Pricing rationale, AI weekly performance-review coaching, metered AI voice receptionist for guest calls. All behind a platform AI-credits system with per-org/property overrides.
- **Integrations**: Resend (email + inbound approval webhook), Meta (Instagram/Messenger), Telegram (5 modules), Google OAuth, PayMongo, Cloudflare Turnstile, Web Push/PWA.
- **Known tracked gaps** (already backlogged elsewhere, not repeated below): Booking.com/VRBO calendar sync (schema-ready, not implemented), PayMongo split-payout/host KYC for parking payouts, AI credit top-up purchase flow ([`ai-credits-topup-purchase.md`](./ai-credits-topup-purchase.md)).

## Competitive landscape snapshot

| Platform                                  | Positioning                                                             | Standout feature                                                                                                                                                                                                                  | Notes                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Guesty](https://www.guesty.com/)         | Enterprise-grade, most channels (100+), pushing hardest into agentic AI | **Agent Hub** — coordinated system of autonomous AI agents (revenue, ops, messaging) unifying pricing/content/availability/policy into one intelligence layer; PriceOptimizer dynamic pricing (+33% RevPAR avg claimed in year 1) | Sets the AI bar the rest of the market is chasing                                                                 |
| [Hostaway](https://www.hostaway.com/)     | Built for scaling PM companies (10–50+ units)                           | 32 real-time OTA connections, 300+ integration marketplace, owner statements/portal                                                                                                                                               | More expensive; per-listing cost drops at scale                                                                   |
| [Lodgify](https://www.lodgify.com/)       | Solo hosts / small portfolios wanting a branded direct-booking site     | Website builder + direct booking engine is the headline feature; clear self-serve pricing from $16/mo                                                                                                                             | Only 12 channel connections — trades reach for a stronger owned-website story                                     |
| [Hospitable](https://www.hospitable.com/) | Independent landlords / small agencies                                  | Unified inbox across OTAs, simpler guest-messaging-first UX                                                                                                                                                                       | Simplified vs. Lodgify/Hostaway; strongest at post-booking guest comms                                            |
| [OwnerRez](https://www.ownerrez.com/)     | Power-user hosts wanting deep customization                             | Native direct integrations (Airbnb/Vrbo/Booking.com/Google Vacation Rentals) plus a large point-solution marketplace (PriceLabs, Truvi, QuickBooks) rather than building everything in-house                                      | Wins by integrating best-of-breed vendors instead of building every module natively — a viable pattern for us too |

## Feature catalog by theme

### 1. AI & Automation (beyond what's shipped)

- 🟢 **Multi-channel unified AI reply** — extend the existing `socialInboxAiService.ts` suggest/auto-reply so it also covers Airbnb/guest-portal messages in the same unified thread, matching Jurny/HiJiffy's "one AI agent across every channel" pattern.
- 🟡 **AI review-response automation** — auto-draft (or auto-post, gated) on-brand replies to guest reviews the moment they land, à la Guesty/Revyoos/Smily. Plugs into the existing guest-review pipeline; reuses the marketing-content AI voice/tone patterns.
- 🟡 **AI voice agent for inbound phone bookings** — extend the already-shipped voice receptionist from Q&A into a booking-capable agent (check availability, quote price, create a pending booking) — closest thing to Guesty's Agent Hub concept, phased in narrower than a full agentic system.
- 🟡 **Agentic "auto-pilot" for routine transitions** — let admins opt specific low-risk workflow transitions (e.g. auto-advance `READY_FOR_CHECKOUT → PENDING_SD_REFUND` when checklist conditions are met) into an AI-supervised auto-execute mode, extending the AI Dashboard Assistant's existing tiered-risk auto-execute model rather than building new infra.
- 🟢 **AI-generated owner performance narratives** — extend the existing AI Performance Review (Analytics) so it also renders as a shareable, brand-formatted owner-facing report — feeds directly into the Owner/Investor Experience theme below.

_See also [`ai-opportunities-roadmap.md`](./ai-opportunities-roadmap.md) for a deeper internal-idea sweep (booking briefings, ID-photo verification, finance anomaly digests, etc.) — that list is complementary, not duplicated here._

### 2. Revenue & Dynamic Pricing

- 🟡 **Market-comp-based auto-pricing** — Smart Pricing today reasons over the property's own calendar history; PriceLabs/Beyond-style tools also ingest external market/comp-set signals. Add an optional external market-data feed (e.g. a comp-set API) as a new pricing signal layered onto the existing Smart Pricing engine.
- 🟢 **Gap-night fill discounts** — auto-detect orphaned single-night gaps between bookings and apply a temporary discount rule, a common PriceLabs/Beyond lever; fits inside the existing pricing-calendar + Smart Pricing autopilot.
- 🟢 **Seasonal pacing rules** — let hosts define seasonal floor/ceiling bands (already partially possible via manual rates); package as a guided Smart Pricing wizard step instead of raw rate editing.
- 🔴 **Competitor rate shopping** — surface nearby comparable listings' live rates for context (requires a scraping/data-partner integration — treat as a Big Bet needing legal/ToS review before committing).

### 3. Guest Monetization / Upsells

- 🟡 **Branded upsell storefront** — early check-in, late checkout, mid-stay clean, pet fee, local experience add-ons presented to every guest post-booking, the pattern behind SuiteOp/ChargeAutomation/Happy Guest. New guest-facing module reusing the existing booking-form payment rails (PayMongo) and guest portal shell.
- 🟢 **Pre-arrival upsell email sequencing** — a scheduled Resend email (7–1 days pre-checkin, the industry-cited optimal window) offering the top 2–3 upsells; reuses existing email template infra + booking-status-triggered scheduling.
- 🟢 **Welcome package / arrival experience upsell** — smallest slice of the storefront to ship first if sequencing a rollout (highest-converting category cited alongside early check-in/late checkout).

### 4. Trust, Safety & Screening

- 🟡 **Guest ID verification + fraud scoring at booking** — extend the existing ID-upload step in the guest form with automated document authenticity checks and a risk score before confirming, the pattern Autohost/Truvi/SuiteVerify/ChargeAutomation all sell as a standalone add-on. Could reuse our existing Gemini-vision receipt-validation pattern rather than buying a vendor.
- 🔴 **No-deposit damage protection option** — offer guests a small paid protection fee instead of a security deposit (Truvi's model, covers up to $1M/stay). Requires either a real insurance/protection underwriting partner or absorbing risk ourselves — treat as Big Bet, needs a partner integration, not buildable in-house alone.
- 🟡 **Noise/occupancy sensor integration** — webhook-ingest data from a Minut/NoiseAware-style sensor to auto-flag policy-violation risk on a booking and notify the host; new integration module, no in-house hardware needed.
- 🟢 **Digital rental agreement e-sign** — attach a house-rules/rental agreement requiring guest e-signature before check-in instructions release; extends the existing document/template system with a signature capture step.

### 5. Smart Home / IoT

- 🟡 **Smart lock integration** — auto-generate a unique guest access code tied to booking status (create on `READY_FOR_CHECKIN`, auto-revoke on checkout/cancellation) via an aggregator (e.g. SuiteConnect-style, 50+ lock brands) rather than integrating each lock brand directly. Ties cleanly into the existing `workflowOrchestrator.ts` transition side-effects pattern.
- 🟡 **Thermostat/utility automation** — auto-adjust thermostat setpoints on check-in/checkout via the same smart-home aggregator, reducing utility costs between stays — natural follow-on once the lock integration's webhook plumbing exists.

### 6. Channel Distribution & Direct Booking

- 🔴 **Additional OTA channel manager (Booking.com, VRBO, Google Vacation Rentals)** — already schema-ready per existing docs; the remaining work (auth flows, rate/availability push, webhook ingestion per channel) is genuinely Big Bet-sized, one channel at a time.
- 🟢 **SEO-friendly public direct-booking site per property** — extends the existing marketing landing pages (6 templates) with proper SEO metadata, sitemap, and a dedicated booking-only URL structure — closing the gap with Lodgify's headline feature using infra we already have.
- 🟡 **Google Vacation Rentals listing feed** — a structured-data feed export from our existing property data, a smaller lift than a full OTA channel integration.

### 7. Operations Automation

- 🟢 **Auto-generated housekeeping/turnover tasks** — auto-create a Maintenance-module task on `READY_FOR_CHECKOUT`/`COMPLETED` transitions (turnover clean, standard checklist), extending `workflowOrchestrator.ts` side effects into the existing Maintenance module rather than building a separate task system.
- 🟡 **Vendor/cleaner marketplace** — let properties assign external cleaning/maintenance vendors with their own limited-access portal view — new scoped-access surface, similar shape to existing property-member scoping.
- 🟡 **Photo-based turnover QA checklist** — cleaner/vendor submits before/after photos against a checklist item, host reviews before marking `READY_FOR_CHECKIN` complete; could reuse existing upload/storage infra plus the AI-vision pattern for automated pass/fail flags later.

### 8. Financial / Trust Accounting

- 🔴 **Formal trust-accounting ledger for owner funds** — a legally-compliant separation of owner trust funds vs. operating funds (Track/LiveTrust/VRTrust's category) — significant compliance and accounting-logic lift; only worth building if targeting markets/clients where trust accounting is a legal requirement (verify demand before committing).
- 🟡 **Automated owner statements & payouts** — extends the existing Finance module: a scheduled per-owner statement (revenue, fees, expenses, net payout) generated and emailed automatically, reusing existing PDF/email infra.
- 🟡 **1099/tax document generation** — year-end tax document generation per owner, a natural pairing with the owner-statements feature above once that ledger data model exists.

### 9. Reputation Management

- 🟢 **Auto-pull OTA reviews into a single feed** — aggregate reviews from connected channels into one internal view, feeding both the AI review-response feature (Theme 1) and...
- 🟢 **Review-to-marketing content pipeline** — this already exists in nascent form (guest-review-to-social-content seeding is shipped); extend it to auto-surface the best new reviews as ready-to-publish marketing content on a schedule rather than requiring manual trigger.

### 10. Compliance & Regulatory

- 🟡 **STR license/registration tracking per property** — a simple per-property compliance record (license number, expiry, jurisdiction) with reminder notifications — relevant given the 2026 regulatory wave (marketplaces now required to verify license numbers in cities like Austin). Low-complexity data model, extends existing property settings + notifications.
- 🔴 **Local occupancy-tax auto-filing** — genuinely Big Bet: either build jurisdiction-specific tax logic in-house (high maintenance burden, constantly-changing rules) or integrate a specialized partner (Avalara MyLodgeTax-style) — partner integration is the pragmatic path, matching OwnerRez's best-of-breed-marketplace strategy rather than building this ourselves.
- 🟢 **Jurisdiction rule alerts** — a lighter-weight version of the above: notify hosts when their property's jurisdiction changes STR rules (manually curated content feed + notification, not automated filing).

### 11. Parking-Specific Innovations

_Distinguishing area — mainstream STR PMS competitors don't cover this vertical at all; SpotHero is the closer comparison here._

- 🟢 **Dynamic parking rate flexing** — SpotHero's "Flex Rates" pattern (demand-based rate adjustment for parking spots) — extends the existing Pricing/Smart Pricing infra to the parking vertical, which today likely uses simpler static rates.
- 🟡 **QR/tap-to-pay at gate** — SpotHero's Scan2Pay pattern for walk-up parking without a pre-booked reservation; new lightweight guest-facing flow reusing existing PayMongo payment rails.
- 🟡 **Employee/commuter subscription parking** — recurring monthly parking passes vs. one-off bookings, a distinct pricing/booking model from the current single-stay parking marketplace.

### 12. Owner/Investor Experience

- 🟡 **Dedicated owner portal** — read-only view (financials, calendar, booking activity) for property owners who aren't operational admins — a common Hostaway/Guesty differentiator; needs a new scoped role narrower than existing property-member permissions (view-only financial + calendar).
- 🟡 **Portfolio-level investor dashboard** — for owners with multiple properties across orgs, an aggregated cross-property performance view — builds on the existing Analytics module's benchmarking work, generalized across an owner's full portfolio rather than one property at a time.

## Recommended near-term picks

Highest sales-impact-per-effort, picked to span guest experience, revenue, and operations rather than clustering in one theme:

1. **SEO-friendly direct-booking site per property** (Theme 6) — closes Lodgify's headline gap using infrastructure we already have (marketing landing pages).
2. **Branded upsell storefront, starting with early check-in/late checkout + welcome package** (Theme 3) — direct revenue-per-booking lift, well-documented $200–800/stay industry benchmark.
3. **Auto-generated housekeeping/turnover tasks from booking status** (Theme 7) — small lift (extends `workflowOrchestrator.ts`), immediate operational value, no new vendor.
4. **STR license/registration tracking + reminders** (Theme 10) — cheap to build, directly relevant given the active 2026 regulatory enforcement wave, easy compliance story for client pitches.
5. **AI review-response automation** (Theme 1/9) — reuses existing AI content-generation patterns and metering, matches a feature every major competitor now advertises.
6. **Smart lock integration via an aggregator** (Theme 5) — biggest "wow" factor for client demos relative to its Mid-Term effort, since it plugs directly into the existing transition side-effects pattern.
7. **Dynamic parking rate flexing** (Theme 11) — a genuine differentiator competitors don't offer at all, since parking is unique to this platform.

This is a suggestion to prioritize discussion, not a decision — each pick still needs its own dedicated plan (scope, phases, exact architecture) before implementation, following the same pattern as other docs in this directory.

## Sources

- Guesty: [Must-have PMS features for 2026](https://www.guesty.com/blog/must-have-property-management-software-features/) · [Agent Hub launch](https://www.prnewswire.com/il/news-releases/guesty-unleashes-the-agentic-revolution-the-first-pms-built-as-a-coordinated-system-of-ai-agents-302786962.html) · [AI Revenue Management Agent](https://www.morningstar.com/news/pr-newswire/20251202io37132/guesty-unveils-first-ai-agent-for-revenue-management-as-it-accelerates-multi-agent-ai-product-strategy) · [PriceOptimizer](https://www.guesty.com/features/guesty-priceoptimizer/) · [Dynamic pricing strategies 2026](https://www.guesty.com/blog/dynamic-pricing-strategies-maximize-revenue/)
- Comparisons: [Guesty vs Hostaway vs Lodgify](https://www.guesty.com/blog/guesty-vs-hostaway-vs-lodgify/) · [Hospitable vs Hostaway](https://www.lodgify.com/comparisons/hospitable-vs-hostaway/) · [Hospitable vs Lodgify](https://stayfi.com/vrm-insider/2026/05/21/hospitable-vs-lodgify/) · [Best STR channel managers 2026](https://staystra.com/best-str-channel-manager-2026-hostaway-guesty-lodgify-ownerrez-beds24/)
- OwnerRez: [Channel management overview](https://www.ownerrez.com/support/articles/channel-management-overview) · [Integrations](https://www.ownerrez.com/integrations)
- Smart locks: [Hostfully smart lock guide](https://www.hostfully.com/blog/the-complete-guide-to-smart-lock-integration-and-keyless-entry-for-vacation-rentals/) · [SuiteOp architecture guide](https://suiteop.com/blog/vacation-rental-software-smart-lock-integration) · [Rentals United provider list](https://rentalsunited.com/blog/smart-locks-keyless-entry-providers-list/)
- Guest screening & damage protection: [Truvi via Hostfully](https://www.hostfully.com/blog/truvi-for-vacation-rentals/) · [SuiteVerify](https://suiteop.com/blog/best-guest-verification-software-short-term-rentals) · [Hostaway screening guide](https://www.hostaway.com/blog/automated-guest-screening-and-identity-verification-tools/) · [ChargeAutomation](https://chargeautomation.com/guest-screening-id-verification/)
- Upsells: [SuiteOp upsells](https://suiteop.com/solutions/upsells) · [Hostaway upsell guide](https://www.hostaway.com/blog/short-term-rental-upsell/) · [Guesty upselling](https://www.guesty.com/blog/short-term-rental-upselling-the-untapped-potential-of-your-properties/) · [Happy Guest](https://www.happyguest.com/revenue/upsells-add-ons)
- AI guest communication: [Vellum best AI assistants 2026](https://www.vellum.ai/blog/best-ai-assistants-for-property-managers) · [Guesty AI tools guide](https://www.guesty.com/blog/ai-tools-for-vacation-rental-automation/) · [Conduit AI comms platforms](https://www.conduit.ai/blog/7-best-ai-guest-communication-platforms-for-hotels-in-2026-tested-ranked)
- Direct booking / owner portal: [Uplisting direct booking](https://www.uplisting.io/property-management-software/direct-booking-website) · [Hostaway feature guide](https://www.hostaway.com/blog/must-have-property-management-software-features-to-get-more-bookings-on/)
- Housekeeping/maintenance: [Breezeway](https://www.breezeway.io/blog/housekeeping-management-software) · [Hostfully cleaning software roundup](https://www.hostfully.com/blog/vacation-rental-cleaning-software/) · [CiiRUS Task Manager](https://www.ciirus.com/features/task-manager)
- Reviews/reputation: [Reviewflowz](https://www.reviewflowz.com/industry/vacation-rental) · [Guesty AI review analysis](https://www.guesty.com/) · [Revyoos](https://www.revyoos.com/w/)
- Compliance/tax: [Redawning 2026 compliance guide](https://www.redawning.com/pm/post/short-term-rental-compliance-management) · [Avalara MyLodgeTax](https://www.avalara.com/mylodgetax/en/blog/2023/04/local-governments-turn-to-technology-to-help-enforce-str-laws.html)
- Noise/occupancy sensors: [Minut](https://www.minut.com/blog/short-term-rental-noise-monitor) · [Houfy Minut vs NoiseAware vs Alertify](https://www.houfy.com/blog/vacation-rental-noise-monitors-minut-vs-noiseaware-vs-alertify)
- Trust accounting: [Track Hospitality](https://tnsinc.com/vacation-rental-trust-accounting-software/) · [VRPlatform trust accounting guide](https://www.vrplatform.app/blog/what-is-trust-accounting-and-why-vacation-rental-managers-cant-ignore-it)
- Parking: [SpotHero for operators](https://spothero.com/sell-parking/operators) · [SpotHero for business](https://spothero.com/business)
- Dynamic pricing engines: [Beyond vs PriceLabs (Hotel Tech Report)](https://hoteltechreport.com/compare/beyond-vs-pricelabs) · [StaySTRA pricing tools showdown](https://staystra.com/pricelabs-vs-wheelhouse-vs-beyond-pricing-2026/)

Back to [planned work index](./README.md).
