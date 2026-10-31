# Page title and favicon inventory

Canonical formats live in `.cursor/rules/page-titles.mdc`. This sheet lists every route and the title it should show.

The HTML fallback (`ui/index.html` `<title>`, `application-name`, `apple-mobile-web-app-title`) is **Kame Homes**. Do not use `Stays` as the product/app title. Guest account nav **Stays** is a page name (`Kame Homes - Stays`), not the app name.

## Format matrix

| Scope                    | Title format                              | Example                               |
| ------------------------ | ----------------------------------------- | ------------------------------------- |
| Public marketing         | `Kame Homes - ${page}`                    | `Kame Homes - Search`                 |
| Public property-scoped   | `${Property Name} - ${page}`              | `Solea Mactan - Calendar`             |
| Guest account            | `Kame Homes - ${page}`                    | `Kame Homes - Stays`                  |
| App-level dashboard      | `Kame Homes - ${page}`                    | `Kame Homes - Sign In`                |
| Org-level dashboard      | `${Org Name} - ${page}`                   | `Kame Homes PH - Bookings`            |
| Property-level dashboard | `${Property Name} - ${page}`              | `Solea Mactan - Bookings`             |
| Parking-level dashboard  | `${Org Name} - ${Parking Name} - ${page}` | `Kame Homes PH - Slot 12A - Bookings` |
| Super admin              | `Kame Homes - ${page}`                    | `Kame Homes - Hosts`                  |

## Public marketing pages

| Route                            | Page name                   | Status                      |
| -------------------------------- | --------------------------- | --------------------------- |
| `/`                              | Home                        | Set                         |
| `/search`                        | Search                      | Set                         |
| `/for-hosts`                     | For Hosts                   | Set                         |
| `/for-hosts/pricing`             | Pricing                     | Set                         |
| `/services`                      | Services                    | Set                         |
| `/hosts/:orgSlug`                | `${host.name}`              | Set                         |
| `/properties`                    | Properties                  | Set                         |
| `/properties/in/:location`       | Properties in ${location}   | Set (inherits Properties)   |
| `/properties/:propertySlug`      | `${property.name}`          | Set                         |
| `/parkings`                      | Parkings                    | Set                         |
| `/parkings/in/:location`         | Parkings in ${location}     | Set (inherits Parkings)     |
| `/parkings/:parkingSlug`         | `${parking.name}`           | Set                         |
| `/parkings/:parkingSlug/form`    | Book                        | Set (property layout)       |
| `/developments`                  | Developments                | Set                         |
| `/developments/in/:location`     | Developments in ${location} | Set (inherits Developments) |
| `/developments/:slug`            | `${development.name}`       | Set                         |
| `/developments/:slug/properties` | Properties                  | Set (property layout)       |
| `/developments/:slug/parking`    | Parking                     | Set (property layout)       |
| `/about`                         | About                       | Set                         |
| `/contact`                       | Contact                     | Set                         |
| `/support`                       | Support                     | Set                         |
| `/terms`                         | Terms                       | Set                         |
| `/privacy`                       | Privacy                     | Set                         |
| `/cookies`                       | Cookies                     | Set                         |

## Public property-scoped operational pages

All use `${Property Name} - ${page}`.

| Route                                          | Page name        | Status       |
| ---------------------------------------------- | ---------------- | ------------ |
| `/properties/:propertySlug/stay-guide`         | Stay Guide       | Set (layout) |
| `/properties/:propertySlug/calendar`           | Calendar         | Set (layout) |
| `/properties/:propertySlug/messages`           | Messages         | Set (layout) |
| `/properties/:propertySlug/form`               | Book             | Set (layout) |
| `/properties/:propertySlug/success`            | Success          | Set (layout) |
| `/properties/:propertySlug/sd-form`            | Security Deposit | Set (layout) |
| `/properties/:propertySlug/guest-review`       | Review           | Set (layout) |
| `/properties/:propertySlug/parking/:bookingId` | Pay Parking      | Set (layout) |

## Guest auth + account

All use `Kame Homes - ${page}`.

| Route                        | Page name       | Status |
| ---------------------------- | --------------- | ------ |
| `/for-hosts/login`           | Sign In         | Set    |
| `/for-hosts/register`        | Register        | Set    |
| `/for-hosts/forgot-password` | Forgot Password | Set    |
| `/for-hosts/reset-password`  | Reset Password  | Set    |
| `/for-hosts/verify-email`    | Verify Email    | Set    |
| `/account/profile`           | Profile         | Set    |
| `/account/stays`             | Stays           | Set    |
| `/account/favorites`         | Favorites       | Set    |

## Dashboard app-level pages

All use `Kame Homes - ${page}`.

| Route                    | Page name             | Status         |
| ------------------------ | --------------------- | -------------- |
| `/onboarding`            | Onboarding            | Auto (sidebar) |
| `/org`                   | Select Organization   | Auto (sidebar) |
| `/verification-rejected` | Verification Rejected | Auto (sidebar) |
| `/accept-invite`         | Accept Invite         | Auto (sidebar) |

## Dashboard org-level pages

Format: `${Org Name} - ${page}`.

| Route                      | Page name  | Status         |
| -------------------------- | ---------- | -------------- |
| `/org/:orgSlug/dashboard`  | Dashboard  | Auto (sidebar) |
| `/org/:orgSlug/bookings`   | Bookings   | Auto (sidebar) |
| `/org/:orgSlug/settings`   | Settings   | Auto (sidebar) |
| `/org/:orgSlug/properties` | Properties | Auto (sidebar) |
| `/org/:orgSlug/parkings`   | Parkings   | Auto (sidebar) |
| `/org/:orgSlug/team`       | Team       | Auto (sidebar) |

## Dashboard property-level pages

Format: `${Property Name} - ${page}`.

| Route                                                      | Page name             | Status         |
| ---------------------------------------------------------- | --------------------- | -------------- |
| `/org/:orgSlug/property/:propertySlug`                     | Dashboard             | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/bookings`            | Bookings              | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/bookings/:bookingId` | Booking: ${guestName} | Set (override) |
| `/org/:orgSlug/property/:propertySlug/finance`             | Finance               | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/pricing`             | Pricing               | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/calendar`            | Pricing (redirect)    | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/maintenance`         | Maintenance           | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/team`                | Team                  | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/marketing`           | Marketing             | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/inbox`               | Inbox                 | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/notifications`       | Notifications         | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/templates`           | Templates             | Auto (sidebar) |
| `/org/:orgSlug/property/:propertySlug/plans`               | Plans & Billing       | Set (page)     |
| `/org/:orgSlug/property/:propertySlug/settings`            | Settings              | Auto (sidebar) |

## Dashboard parking-level pages

Format: `${Org Name} - ${Parking Name} - ${page}`.

| Route                                                    | Page name             | Status          |
| -------------------------------------------------------- | --------------------- | --------------- |
| `/org/:orgSlug/parking/:parkingSlug`                     | Dashboard             | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/bookings`            | Bookings              | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/bookings/:bookingId` | Booking: ${guestName} | Override needed |
| `/org/:orgSlug/parking/:parkingSlug/finance`             | Finance               | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/pricing`             | Pricing               | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/team`                | Team                  | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/inbox`               | Inbox                 | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/notifications`       | Notifications         | Auto (sidebar)  |
| `/org/:orgSlug/parking/:parkingSlug/settings`            | Settings              | Auto (sidebar)  |

## Super admin pages

All use `Kame Homes - ${page}`.

| Route                                  | Page name               | Status         |
| -------------------------------------- | ----------------------- | -------------- |
| `/admin`                               | Overview                | Auto (sidebar) |
| `/admin/developments`                  | Developments            | Auto (sidebar) |
| `/admin/developments/:developmentSlug` | Development Detail      | Auto (sidebar) |
| `/admin/approvals`                     | Approvals               | Auto (sidebar) |
| `/admin/hosts`                         | Hosts                   | Auto (sidebar) |
| `/admin/settings`                      | Settings                | Auto (sidebar) |
| `/admin/properties`                    | Properties              | Auto (sidebar) |
| `/admin/hosts/:hostId/orgs`            | Host Organizations      | Auto (sidebar) |
| `/admin/hosts/:hostId/orgs/properties` | Host Properties         | Auto (sidebar) |
| `/admin/orgs/:orgSlug/properties`      | Organization Properties | Auto (sidebar) |

## Remaining work / overrides

- `ParkingBookingDetailPage` should override the title with `Booking: ${guestName}` (currently only the property booking detail does this).
- Detail pages that are not in the sidebar nav rely on the parent sidebar label. Add explicit overrides where the entity name matters.
- Favicon: org logo is applied to dashboard and property public pages. Public marketing pages reset to default. Host public page does not yet use the host logo (could add if desired).

## Suggestions

- Keep the sidebar label as the source of truth for page names so the title stays in sync with navigation.
- For booking detail, use the primary guest name rather than the booking ID; the ID is already in the URL.
- For property public pages, use the residence name (the name guests know) over the property name if they differ.
- If an org or property has a long name, the title may truncate; that is fine for browser tabs.
