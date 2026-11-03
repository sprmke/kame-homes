---
title: 'Local Google credentials (Maps + OAuth)'
status: active
tags: [guides, testing, local, google]
updated: 2026-11-04
---

# Local Google credentials (Maps + OAuth)

The local stack should not use the production Google OAuth client or the production Maps
key. Both are free to create and take about 10 minutes.

Result:

| Value                      | Goes in               | Used by                                           |
| -------------------------- | --------------------- | ------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY` | `ui/.env.development` | Location picker, listing map, Places autocomplete |
| `GOOGLE_CLIENT_ID`         | `ui/.env.development` | Local GoTrue Google sign-in                       |
| `GOOGLE_CLIENT_SECRET`     | `ui/.env.development` | Local GoTrue Google sign-in                       |

## 1. Create a separate Google Cloud project

1. Open https://console.cloud.google.com/projectcreate.
2. Project name: `Kame Space Local`. Organisation: leave as is.
3. Create, then make sure the project selector (top bar) shows `Kame Space Local`.

Do not reuse the production project: a leaked local key would then share the production
quota and referrer rules.

## 2. Enable the APIs the app loads

Open **APIs & Services → Library** and enable each:

- Maps JavaScript API
- Places API
- Places API (New)
- Geocoding API
- Maps Embed API

The picker loads `core`, `maps`, `places`, `geocoding` (`useGoogleMapsLoader.ts`); the public
listing map uses the Embed API.

## 3. OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External**. App name: `Kame Space Local`. Support email and developer email:
   your own.
3. Save. You do not need verification for local sign-in.
4. **Test users → Add users**: add the Google account you sign in with.

## 4. OAuth client for local GoTrue

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `Kame Space local dev`.
3. Authorized JavaScript origins:

   ```
   http://127.0.0.1:5173
   http://localhost:5173
   ```

4. Authorized redirect URIs:

   ```
   http://127.0.0.1:54321/auth/v1/callback
   http://localhost:54321/auth/v1/callback
   ```

5. Create, then copy the **Client ID** and **Client secret**.

## 5. Maps API key

1. **APIs & Services → Credentials → Create credentials → API key**.
2. Name: `Kame Space local maps`.
3. **Edit** the key:
   - Application restrictions: **Websites**. Add
     `http://127.0.0.1:5173/*` and `http://localhost:5173/*`.
   - API restrictions: **Restrict key**, select the five APIs from step 2.
4. Save and copy the key.

Optional but recommended: **Billing → Budgets & alerts** with a small monthly budget so a
leaked key cannot run up a bill.

## 6. Put the values in the local profile

Edit `ui/.env.development` (gitignored):

```bash
VITE_GOOGLE_MAPS_API_KEY=<local maps key>
GOOGLE_CLIENT_ID=<local client id>
GOOGLE_CLIENT_SECRET=<local client secret>
```

GoTrue reads `GOOGLE_*` when the container starts, so restart the stack:

```bash
bun run stop:supabase && ./dev.sh
```

## Verify

- Local map picker renders and location search returns results.
- Sign-in with Google on `/auth` completes and returns to `127.0.0.1:5173`.
- Production `VITE_GOOGLE_MAPS_API_KEY` and the production OAuth client are untouched.

If sign-in returns `Unsupported provider: missing redirect URI`, the redirect URI in step 4
does not match `supabase/config.toml` `[auth.external.google] redirect_uri`.
