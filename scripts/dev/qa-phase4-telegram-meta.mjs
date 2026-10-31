#!/usr/bin/env bun
import { $ } from 'bun';

async function cliEval(js) {
  const out = await $`bun x playwright-cli eval ${js}`.nothrow().text();
  const m = out.match(/### Result\n([\s\S]*?)\n### Ran/);
  if (!m) return { error: 'no_result', snippet: out.slice(-500) };
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return { raw: m[1].trim().slice(0, 1000) };
  }
}

const BASE = 'http://localhost:5173/org/kame-home/property/monaco-2612';

await $`bun x playwright-cli goto ${`${BASE}/notifications`}`.nothrow().quiet();
await Bun.sleep(2500);
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Chat' })`}`.nothrow().quiet();
await Bun.sleep(1200);

let s = await cliEval(`(() => {
  const inputs = [...document.querySelectorAll('input,textarea')].map(i => ({
    id: i.id,
    type: i.type,
    aria: i.getAttribute('aria-label'),
    ph: i.placeholder,
    len: (i.value || '').length,
    disabled: i.disabled,
  }));
  const save = [...document.querySelectorAll('button')].find(b =>
    /Save and test/i.test(b.innerText || '')
  );
  return {
    inputs: inputs.slice(0, 15),
    saveDisabled: save?.disabled,
    saveText: (save?.innerText || '').trim(),
  };
})()`);
console.log('fields', JSON.stringify(s));

await $`bun x playwright-cli click ${`getByRole('button', { name: 'Manage' })`}`.nothrow().quiet();
await Bun.sleep(1200);
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Send preview' })`}`.nothrow().quiet();
await Bun.sleep(4500);
s = await cliEval(`(() => ({
  toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0, 10),
  dialog: document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g, ' ').trim().slice(0, 500) || null,
}))()`);
console.log('send_preview', JSON.stringify(s));

// Close dialog if open
await $`bun x playwright-cli press Escape`.nothrow().quiet();
await Bun.sleep(400);

// API verify: resolve property id then POST verify without printing secrets
s = await cliEval(`async () => {
  const raw = localStorage.getItem('sb-127-auth-token');
  if (!raw) return { err: 'no_session' };
  const sess = JSON.parse(raw);
  const token = sess.access_token;
  const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  const propRes = await fetch(
    'http://127.0.0.1:54321/rest/v1/properties?slug=eq.monaco-2612&select=id,organization_id',
    { headers: { apikey: anon, Authorization: 'Bearer ' + token } }
  );
  const props = await propRes.json();
  const propertyId = props?.[0]?.id;
  if (!propertyId) return { err: 'no_property', props, status: propRes.status };

  const verifyRes = await fetch(
    'http://127.0.0.1:54321/functions/v1/telegram-chat-settings?property_id=' + propertyId,
    {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'verify_chat_telegram_env' }),
    }
  );
  const body = await verifyRes.json().catch(() => ({}));
  // scrub any credential-looking fields
  const scrubbed = {
    status: verifyRes.status,
    ok: body?.ok ?? body?.getMe?.ok ?? null,
    getMeOk: body?.getMe?.ok ?? null,
    username: body?.getMe?.username ?? body?.username ?? null,
    getChatOk: body?.getChat?.ok ?? null,
    chatTitle: body?.getChat?.title ?? body?.chat?.title ?? null,
    error: body?.error || body?.getMe?.error || body?.message || null,
    keys: Object.keys(body || {}).slice(0, 20),
  };
  return scrubbed;
})()`);
console.log('api_verify', JSON.stringify(s));

// Also start Meta OAuth URL generation via API
s = await cliEval(`async () => {
  const raw = localStorage.getItem('sb-127-auth-token');
  const sess = JSON.parse(raw);
  const token = sess.access_token;
  const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  const orgRes = await fetch(
    'http://127.0.0.1:54321/rest/v1/organizations?slug=eq.kame-home&select=id',
    { headers: { apikey: anon, Authorization: 'Bearer ' + token } }
  );
  const orgId = (await orgRes.json())?.[0]?.id;
  const res = await fetch('http://127.0.0.1:54321/functions/v1/meta-inbox-oauth-start', {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orgId,
      orgSlug: 'kame-home',
      returnPath: '/org/kame-home/property/monaco-2612/inbox',
      scope: 'property',
      propertySlug: 'monaco-2612',
    }),
  });
  const body = await res.json().catch(() => ({}));
  const url = body?.url || body?.oauthUrl || body?.redirectUrl || '';
  return {
    status: res.status,
    error: body?.error || body?.message || null,
    hasUrl: !!url,
    isFacebook: /facebook\\.com/.test(url),
    appIdInUrl: /1322356823214127/.test(url),
    urlHost: url ? new URL(url).host : null,
    keys: Object.keys(body || {}).slice(0, 15),
  };
})()`);
console.log('oauth_start', JSON.stringify(s));
