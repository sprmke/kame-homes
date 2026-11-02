/**
 * Public GET: Meta redirects here with ?code=&state=.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  buildMetaOAuthErrorRedirect,
  buildMetaOAuthPickerRedirect,
  buildMetaOAuthSuccessRedirect,
  isMetaReturnOriginAllowed,
  parseMetaOAuthAllowedReturnOrigins,
} from '../_shared/metaInboxConfig.ts';
import {
  connectMetaInboxPage,
  encryptMetaUserToken,
  metaPagesForPicker,
} from '../_shared/metaInboxConnect.ts';
import {
  exchangeMetaCodeForToken,
  exchangeMetaLongLivedUserToken,
  fetchMetaUserPages,
} from '../_shared/metaInboxGraph.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { captureSentryException } from '../_shared/sentry.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders(req) });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const sb = createServiceClient();

  async function loadState() {
    if (!state) return null;
    const { data } = await sb
      .from('meta_inbox_oauth_state')
      .select('organization_id, return_origin, return_path, expires_at, property_id, parking_id')
      .eq('state', state)
      .maybeSingle();
    if (!data) return null;
    const exp = new Date(data.expires_at as string).getTime();
    if (Number.isNaN(exp) || Date.now() > exp) return null;
    if (!isMetaReturnOriginAllowed(data.return_origin as string)) return null;
    return data as {
      organization_id: string;
      return_origin: string;
      return_path: string;
      property_id: string | null;
      parking_id: string | null;
    };
  }

  const st = await loadState();
  const fallbackOrigin = () => parseMetaOAuthAllowedReturnOrigins()[0] ?? 'http://127.0.0.1:5173';

  if (oauthError) {
    const dest = st
      ? buildMetaOAuthErrorRedirect(st.return_origin, st.return_path, oauthError)
      : `${fallbackOrigin()}/inbox?meta_inbox_error=${encodeURIComponent(oauthError)}`;
    if (state) await sb.from('meta_inbox_oauth_state').delete().eq('state', state);
    return Response.redirect(dest, 302);
  }

  if (!code || !state || !st) {
    const dest = st
      ? buildMetaOAuthErrorRedirect(st.return_origin, st.return_path, 'invalid_state')
      : `${fallbackOrigin()}/inbox?meta_inbox_error=invalid_state`;
    return Response.redirect(dest, 302);
  }

  if (!(await isFeatureAvailable('inbox.meta.connect'))) {
    const dest = buildMetaOAuthErrorRedirect(
      st.return_origin,
      st.return_path,
      'feature_unavailable'
    );
    if (state) await sb.from('meta_inbox_oauth_state').delete().eq('state', state);
    return Response.redirect(dest, 302);
  }

  try {
    const short = await exchangeMetaCodeForToken(code);
    const userToken = await exchangeMetaLongLivedUserToken(short.access_token);
    const pages = await fetchMetaUserPages(userToken);
    if (!pages.length) {
      const dest = buildMetaOAuthErrorRedirect(st.return_origin, st.return_path, 'no_pages');
      await sb.from('meta_inbox_oauth_state').delete().eq('state', state);
      return Response.redirect(dest, 302);
    }

    if (pages.length === 1) {
      await connectMetaInboxPage(st.organization_id, pages[0]!, {
        propertyId: st.property_id,
        parkingId: st.parking_id,
      });
      await sb.from('meta_inbox_oauth_state').delete().eq('state', state);
      return Response.redirect(
        buildMetaOAuthSuccessRedirect(st.return_origin, st.return_path),
        302
      );
    }

    const encryptedUserToken = await encryptMetaUserToken(userToken);
    const { error: updateErr } = await sb
      .from('meta_inbox_oauth_state')
      .update({
        encrypted_user_token: encryptedUserToken,
        pending_pages: metaPagesForPicker(pages),
      })
      .eq('state', state);
    if (updateErr) {
      console.error('[meta-inbox-oauth-callback] pending pages:', updateErr);
      throw updateErr;
    }

    return Response.redirect(
      buildMetaOAuthPickerRedirect(st.return_origin, st.return_path, state),
      302
    );
  } catch (e) {
    console.error('[meta-inbox-oauth-callback]', e);
    await captureSentryException(e, {
      logPrefix: 'meta-inbox-oauth-callback',
      url: req.url,
      method: req.method,
      tags: { provider: 'meta' },
      fingerprint: ['meta-inbox-oauth-callback'],
    });
    const dest = buildMetaOAuthErrorRedirect(
      st.return_origin,
      st.return_path,
      'token_exchange_failed'
    );
    await sb.from('meta_inbox_oauth_state').delete().eq('state', state);
    return Response.redirect(dest, 302);
  }
});
