# Google Cloud Console cleanup checklist

Use this **before** brand verification or any public launch. Pair with the summary: [google-services-approval.md](./google-services-approval.md).

**Pre-flight:** Confirm production is on the inbound approval path ([approval-email-inbound.md](./approval-email-inbound.md)) and Connect Google / Gmail listener code is not deployed.

---

## Order of operations

### Step 1 — Confirm zero traffic (7 days recommended)

In **APIs & Services → Dashboard**, verify **no requests** to:

- Gmail API
- Google Calendar API
- Google Sheets API

In **Logs / Metrics**, confirm the old service account (if any) has no Calendar/Sheets calls.

### Step 2 — Disable unused APIs

**APIs & Services → Enabled APIs → disable:**

- [ ] Gmail API
- [ ] Google Calendar API
- [ ] Google Sheets API
- [ ] Google Drive API (if enabled only for Sheets)

**Keep enabled** (Maps — see [google-services-approval.md §4](./google-services-approval.md#4-maps--enable-only-what-we-need-cost-control)):

- [ ] Maps JavaScript API
- [ ] Places API
- [ ] Geocoding API
- [ ] Maps Embed API (if using keyed embeds)
- [ ] Maps Static API (optional — chat previews only)

### Step 3 — OAuth consent screen scopes

**OAuth consent screen → Data access / Scopes → remove:**

- [ ] `gmail.readonly` and all other Gmail scopes
- [ ] `calendar`, `calendar.events`, etc.
- [ ] `spreadsheets`

**Keep:**

- [ ] `openid`, `userinfo.email`, `userinfo.profile` (Sign in with Google via Supabase)

### Step 4 — Credentials

- [ ] **Delete** unused OAuth client whose redirect was `…/google-mail-oauth-callback`
- [ ] **Keep** Supabase Auth Web client — redirects include `https://<ref>.supabase.co/auth/v1/callback`
- [ ] **Restrict** Maps browser API key (referrers + API list) — see main guide §4
- [ ] **Delete** service account **keys** for Calendar/Sheets (after Step 1 monitoring window)

### Step 5 — Publish & verify Sign-in

- [ ] Homepage + Privacy + Terms live on verified domain
- [ ] **Publish app** on OAuth consent screen → complete **brand verification** if prompted
- [ ] No CASA unless Gmail API returns

---

## Rollback note

Keep the service account **identity** (not necessarily keys) for ~30 days after disable if you might need emergency rollback. Calendar/Sheets code is removed from the repo — rollback would be a code revert, not console-only.

---

## Done when

- Enabled API list matches §4 of [google-services-approval.md](./google-services-approval.md)
- OAuth consent screen shows **Sign-in scopes only**
- No orphaned Gmail OAuth client
- Maps key restricted and budget alerts set
- Brand verification submitted or approved for External Sign-in
