# Google services — what we use, cleanup, and approval

Short operator guide for **Kame Homes today** (after Gmail / Calendar / Sheets removal).  
PMO approvals use **Resend inbound** — see [approval-email-inbound.md](./approval-email-inbound.md). **No Gmail API. No CASA.**

---

## 1. What we use now (only two Google tracks)

| Track                   | Used for                                                                              | In the app                                                                                                         | Google Cloud setup                                              |
| ----------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Sign in with Google** | Host login, guest login, team invite accept                                           | Supabase Auth (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Supabase; `signInWithOAuth({ provider: 'google' })`) | OAuth consent screen + **one Web client** for Supabase callback |
| **Maps Platform**       | Property address search + map pin, listing map, property map embeds, chat map preview | `VITE_GOOGLE_MAPS_API_KEY` in the browser                                                                          | **API key** (not OAuth) + billing                               |

**Not Google (do not confuse with “calendar” in the product):**

- **Airbnb / OTA calendar sync** = external `.ics` feeds (`calendar-sync-cron`) — **not** Google Calendar API.
- **GAF/pet approvals** = **Resend Receiving** webhook (`approval-email-webhook`) — **not** Gmail API.

---

## 2. Do we need Google “app approval”?

| Track                   | Approval needed?                   | Why                                                                                                                                                                      |
| ----------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sign in with Google** | **Yes — light brand verification** | External app showing app name/logo on the consent screen. Scopes are **non-sensitive** (`openid`, `email`, `profile`) — **no CASA**, no Gmail-style security assessment. |
| **Maps API key**        | **No OAuth app review**            | Browser key + enabled APIs + billing. Restrict the key instead.                                                                                                          |

**You do not need** restricted-scope verification or CASA unless you bring back **Gmail read** (`gmail.readonly`) or similar.

Typical timeline for Sign-in brand verification: **~2–3 business days** after a complete submission.

---

## 3. GCP cleanup — disable what we removed

Do this **before** submitting for verification so the project only shows what you still use.

### 3.1 Disable APIs (APIs & Services → Library)

**Disable** (if still enabled):

- Gmail API
- Google Calendar API
- Google Sheets API
- Google Drive API (only if you enabled it for Sheets)
- Any other Google APIs with **zero** recent traffic in the dashboard

**Keep enabled** — see §4 (Maps only).

### 3.2 OAuth consent screen (APIs & Services → OAuth consent screen)

1. **Remove scopes** you no longer request:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/spreadsheets`
   - Any other Gmail / Calendar / Sheets / Drive scopes
2. **Keep** only Sign-in scopes (non-sensitive):
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
3. Confirm **Authorized domains** match your live site (e.g. `kamehomes.space`) and Supabase auth callback domain if listed.

### 3.3 OAuth clients (APIs & Services → Credentials)

| Client                                           | Action                                                                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase Auth Web client**                     | **Keep** — redirect URIs must include `https://<project-ref>.supabase.co/auth/v1/callback` and local `http://127.0.0.1:54321/auth/v1/callback` / `http://localhost:54321/auth/v1/callback`. |
| **Old “Connect Google” / Gmail listener client** | **Delete** if it still exists (callback was `…/functions/v1/google-mail-oauth-callback`). Code for that flow is removed.                                                                    |

### 3.4 Service account (if you created one for Calendar/Sheets)

- **Delete active keys** after 7+ days with zero Calendar/Sheets API calls.
- You may keep the service account identity for a grace period; it is unused by current code.

### 3.5 Secrets / env (hosted + local)

Remove or stop setting (no longer used by app code):

- `GMAIL_API_WEB_CLIENT_JSON`, `GMAIL_OAUTH_CLIENT_JSON`, `GMAIL_OAUTH_TOKEN_JSON`
- `GOOGLE_SERVICE_ACCOUNT`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SPREADSHEET_ID`

**Still required:**

- Supabase Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- UI: `VITE_GOOGLE_MAPS_API_KEY`
- `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY` — **keep** (still used for Telegram tokens + encrypted integration secrets; name is legacy)

---

## 4. Maps — enable only what we need (cost control)

Code references (`ui/src/lib/google-maps/useGoogleMapsLoader.ts`, `PropertyLocationPicker`, `ListingMapView`, `propertyMapEmbed.ts`, `ChatMapLinkCard.tsx`):

| GCP API                 | Required?       | Used for                                                                |
| ----------------------- | --------------- | ----------------------------------------------------------------------- |
| **Maps JavaScript API** | **Yes**         | Interactive map picker, listing map view                                |
| **Places API**          | **Yes**         | Address autocomplete (`google.maps.places.Autocomplete`)                |
| **Geocoding API**       | **Yes**         | Reverse geocode on map click / place select (`google.maps.Geocoder`)    |
| **Maps Embed API**      | **Recommended** | Property/showcase embeds when key is set (`maps/embed/v1/place`)        |
| **Maps Static API**     | **Optional**    | Chat map link preview images only — disable if you drop static previews |

**Do not enable** (unless you add a feature later): Directions, Distance Matrix, Roads, Street View Static, Time Zone, etc.

### Maps API key hardening

1. **Credentials → API key → Application restrictions:** HTTP referrers
   - `https://*.kamehomes.space/*` (adjust to your domains)
   - `https://kame-homes.vercel.app/*` (Preview if needed)
   - `http://localhost:*` / `http://127.0.0.1:*` for local dev only
2. **API restrictions:** Restrict key to the five APIs in the table above (or four if Static is off).
3. **Billing:** turn on billing alerts / budget caps in GCP Billing.
4. **Fallbacks already in code:** without a key, map embeds can fall back to legacy Google embed or OpenStreetMap — picker UI shows a clear “add API key” message.

---

## 5. Sign in with Google — short approval checklist

**Before submit**

- [ ] Production **homepage** (public, not login-only) with links to **Privacy** and **Terms**
- [ ] **Privacy policy** mentions Google Sign-In (email/profile for authentication) — **not** Gmail mailbox access
- [ ] **Domain verified** in Google Search Console (same Google account as GCP Owner/Editor)
- [ ] OAuth consent screen: app name, logo, support email, homepage / privacy / terms URLs filled in
- [ ] Only **non-sensitive** Sign-in scopes on the consent screen (§3.2)
- [ ] Supabase Auth redirect URIs match the Web client (§3.3)
- [ ] UI uses [Sign in with Google branding](https://developers.google.com/identity/branding-guidelines) on `/for-hosts/login` and invite flows

**Submit**

1. OAuth consent screen → **Publish app** (Testing → **In production**).
2. If prompted, complete **Prepare for verification** / brand verification (no scope justification video for Gmail).
3. Watch the project owner email for Google follow-ups (~2–3 business days).

**After approval**

- External users see your app name/logo on consent instead of the “unverified app” warning.
- Maps: no change — keep monitoring billing and key restrictions.

---

## 6. Quick reference — removed vs current

| Removed                                  | Replaced by                                                 |
| ---------------------------------------- | ----------------------------------------------------------- |
| Gmail API listener / Connect Google      | Resend `approval-email-webhook`                             |
| Google Calendar sync on booking workflow | Removed (optional manual ops; OTA sync is iCal, not Google) |
| Google Sheets booking row sync           | Removed                                                     |
| CASA / restricted Gmail verification     | **Not required** while Gmail API stays off                  |

---

## Related docs

- [approval-email-inbound.md](./approval-email-inbound.md) — PMO approval email setup
- [migration-runbook.md](./migration-runbook.md) — local `GOOGLE_CLIENT_*` + Supabase Auth
- [validation-and-env.md](../../architecture/validation-and-env.md) — env var index
- Historical: [remove-google-calendar-sheets.md](../../workflow/done/remove-google-calendar-sheets.md), [google-oauth-verification.md](../../workflow/wont-do/google-oauth-verification.md) (CASA pivot)
