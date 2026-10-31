# Competitive UX — benchmark matrix

Quick map: **which app to study** for a given task. Prefer live product or recent articles over old blog posts.

## Guest (explore & book)

| Task                      | Study first             | Notes                                       |
| ------------------------- | ----------------------- | ------------------------------------------- |
| Search / dates / calendar | Airbnb                  | Range selection, blocked dates, min nights  |
| Listing detail            | Airbnb                  | Gallery, amenities, house rules, sticky CTA |
| Reserve / checkout        | Airbnb                  | Payment timing, auth modal, price breakdown |
| Guest messaging           | Airbnb Trips / Messages | Thread list, quick replies                  |
| Reviews / post-stay       | Airbnb                  | Prompt timing, single CTA                   |
| Trip changes / cancel     | Airbnb                  | Self-serve vs contact host                  |

## Host acquisition & auth

| Task                       | Study first          | Notes                              |
| -------------------------- | -------------------- | ---------------------------------- |
| Host landing               | Airbnb Host          | Value prop, CTA to list or sign in |
| Host sign-in               | Airbnb Host / Guesty | OAuth-first vs email               |
| Onboarding / first listing | Airbnb Host setup    | Step count, deferrals              |

## Operator / PMS (admin)

| Task                           | Study first              | Notes                                  |
| ------------------------------ | ------------------------ | -------------------------------------- |
| Bookings list                  | Guesty, Hostaway         | Filters, status chips, bulk actions    |
| Booking detail / workflow      | Guesty                   | Timeline, tasks, documents             |
| Calendar (multi-property)      | Guesty, Hostaway         | Color coding, drag, conflicts          |
| Pricing / rates                | Guesty, Lodgify          | Rules, seasons, fees                   |
| Finance / ledger               | Guesty                   | Stays vs expenses, export              |
| Maintenance                    | Hostaway                 | Tasks, vendors, reminders              |
| Team / permissions             | Guesty                   | Roles, property scope                  |
| Templates / automations        | Hospitable, Guesty       | Message templates, triggers            |
| Channel inbox                  | Guesty Inbox, Hospitable | Meta/Airbnb threads, assign, AI assist |
| Integrations                   | Guesty                   | OAuth connect cards, status badges     |
| Notifications (Telegram/email) | Hospitable               | Per-channel toggles                    |
| Property settings              | Lodgify                  | Branding, location, policies           |

## Search query templates

```
Airbnb guest [booking|checkout|calendar|messages] UX flow
Guesty [bookings|inbox|calendar|automation] dashboard UX
Hostaway [reservations|finance|maintenance] how to
Lodgify [pricing|guest communication] property manager
```

## Adaptation checklist for Kame Homes

- [ ] Mobile-first at 375px (`mobile-responsive.mdc`)
- [ ] No extra UI copy (`minimal-ui-copy`)
- [ ] Guest auth modal only at commit points
- [ ] Org/property scoping on admin surfaces
- [ ] Asia/Manila dates and PHP where shown
- [ ] Route guide updated if behavior ships
