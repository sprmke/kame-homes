#!/usr/bin/env bun
import { $ } from 'bun';

async function cliEval(js) {
  const out = await $`bun x playwright-cli eval ${js}`.nothrow().text();
  const m = out.match(/### Result\n([\s\S]*?)\n### Ran/);
  if (!m) return { error: 'no_result', snippet: out.slice(-700) };
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return { raw: m[1].trim().slice(0, 1000) };
  }
}

// Pull access token from browser (do not print full token)
const tok = await cliEval(`(() => {
  const raw = localStorage.getItem('sb-127-auth-token');
  if (!raw) return { err: 'no_session' };
  const s = JSON.parse(raw);
  return { access_token: s.access_token, len: (s.access_token || '').length };
})()`);
if (!tok.access_token) {
  console.log('no_token', JSON.stringify(tok));
  process.exit(1);
}
const access = tok.access_token;
const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const headers = {
  apikey: anon,
  Authorization: `Bearer ${access}`,
  'Content-Type': 'application/json',
};

const props = await fetch(
  'http://127.0.0.1:54321/rest/v1/properties?slug=eq.monaco-2612&select=id,organization_id',
  { headers: { apikey: anon, Authorization: `Bearer ${access}` } }
).then((r) => r.json());
const propertyId = props?.[0]?.id;
const orgId = props?.[0]?.organization_id;
console.log('ids', JSON.stringify({ propertyId: !!propertyId, orgId: !!orgId, propStatus: Array.isArray(props) }));

const verifyRes = await fetch(
  `http://127.0.0.1:54321/functions/v1/telegram-chat-settings?property_id=${propertyId}`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'verify_chat_telegram_env' }),
  }
);
const verifyBody = await verifyRes.json().catch(() => ({}));
console.log(
  'api_verify',
  JSON.stringify({
    status: verifyRes.status,
    getMeOk: verifyBody?.getMe?.ok ?? null,
    username: verifyBody?.getMe?.username ?? null,
    getChatOk: verifyBody?.getChat?.ok ?? null,
    chatTitle: verifyBody?.getChat?.title ?? null,
    error: verifyBody?.error || verifyBody?.message || verifyBody?.getMe?.error || null,
    keys: Object.keys(verifyBody || {}),
  })
);

// Try several oauth-start body shapes used by UI
const startMetaInboxOAuthBodies = [
  {
    organizationId: orgId,
    returnPath: '/org/kame-home/property/monaco-2612/inbox',
  },
  {
    orgId,
    orgSlug: 'kame-home',
    returnPath: '/org/kame-home/property/monaco-2612/inbox',
  },
];

for (const body of startMetaInboxOAuthBodies) {
  const res = await fetch('http://127.0.0.1:54321/functions/v1/meta-inbox-oauth-start', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  const url = j?.url || j?.oauthUrl || j?.redirectUrl || j?.authorizationUrl || '';
  console.log(
    'oauth_start',
    JSON.stringify({
      status: res.status,
      keys: Object.keys(j || {}),
      error: j?.error || j?.message || null,
      hasUrl: !!url,
      isFacebook: /facebook\.com/.test(url),
      appIdInUrl: /1322356823214127/.test(url),
      host: url ? (() => { try { return new URL(url).host; } catch { return 'bad'; } })() : null,
    })
  );
  if (url) break;
}

// Shared bot Save and test: fill from module token length only — copy via UI without printing
await $`bun x playwright-cli goto http://localhost:5173/org/kame-home/property/monaco-2612/notifications`.nothrow().quiet();
await Bun.sleep(2000);
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Chat' })`}`.nothrow().quiet();
await Bun.sleep(1000);

const copy = await cliEval(`(() => {
  const module = document.querySelector('#chat-bot-token');
  const global = document.querySelector('#global-bot-token');
  if (!module || !global) return { err: 'missing fields' };
  const v = module.value;
  global.focus();
  global.value = v;
  global.dispatchEvent(new Event('input', { bubbles: true }));
  global.dispatchEvent(new Event('change', { bubbles: true }));
  const save = [...document.querySelectorAll('button')].find(b => /Save and test/i.test(b.innerText || ''));
  return { moduleLen: v.length, globalLen: global.value.length, saveDisabled: save?.disabled };
})()`);
console.log('copy_token', JSON.stringify(copy));
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Save and test' })`}`.nothrow().quiet();
await Bun.sleep(4000);
const after = await cliEval(`(() => ({
  toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0, 8),
  saved: /\\bSaved\\b/i.test(document.body.innerText),
  savePresent: [...document.querySelectorAll('button')].some(b => /Save and test/i.test(b.innerText || '')),
}))()`);
console.log('global_save_test', JSON.stringify(after));
