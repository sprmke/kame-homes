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

await Bun.sleep(3000);

const tok = await cliEval(`(() => {
  const raw = localStorage.getItem('sb-127-auth-token');
  if (!raw) return { err: 'no_session' };
  return { access_token: JSON.parse(raw).access_token };
})()`);
if (!tok.access_token) {
  console.log('need_reauth');
  await $`bun scripts/dev/qa-phase4-auth-inject.mjs`.nothrow();
}
const tok2 = await cliEval(`(() => ({ access_token: JSON.parse(localStorage.getItem('sb-127-auth-token')||'{}').access_token }))()`);
const access = tok2.access_token;
const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const headers = {
  apikey: anon,
  Authorization: `Bearer ${access}`,
  'Content-Type': 'application/json',
  Origin: 'http://localhost:5173',
};

const props = await fetch(
  'http://127.0.0.1:54321/rest/v1/properties?slug=eq.monaco-2612&select=id,organization_id',
  { headers: { apikey: anon, Authorization: `Bearer ${access}` } }
).then((r) => r.json());
const propertyId = props?.[0]?.id;
const orgId = props?.[0]?.organization_id;

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

const oauthRes = await fetch(
  `http://127.0.0.1:54321/functions/v1/meta-inbox-oauth-start?org_id=${orgId}&property_id=${propertyId}`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      returnPath: '/org/kame-home/property/monaco-2612/inbox',
      propertyId,
      organizationId: orgId,
    }),
  }
);
const oauthBody = await oauthRes.json().catch(() => ({}));
const url = oauthBody?.data?.url || oauthBody?.url || '';
console.log(
  'oauth_api',
  JSON.stringify({
    status: oauthRes.status,
    keys: Object.keys(oauthBody || {}),
    dataKeys: Object.keys(oauthBody?.data || {}),
    error: oauthBody?.error || oauthBody?.message || null,
    hasUrl: !!url,
    isFacebook: /facebook\.com/.test(url),
    appIdInUrl: /1322356823214127/.test(url),
  })
);

// Shared bot: React fill via native setter + Save and test
await $`bun x playwright-cli goto http://localhost:5173/org/kame-home/property/monaco-2612/notifications`.nothrow().quiet();
await Bun.sleep(2500);
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Chat' })`}`.nothrow().quiet();
await Bun.sleep(1000);

const filled = await cliEval(`(() => {
  const module = document.querySelector('#chat-bot-token');
  const global = document.querySelector('#global-bot-token');
  if (!module || !global) return { err: 'missing' };
  const v = module.value;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(global, v);
  global.dispatchEvent(new Event('input', { bubbles: true }));
  global.dispatchEvent(new Event('change', { bubbles: true }));
  const save = [...document.querySelectorAll('button')].find(b => /Save and test/i.test(b.innerText || ''));
  return { globalLen: global.value.length, saveDisabled: !!save?.disabled };
})()`);
console.log('react_fill', JSON.stringify(filled));

await $`bun x playwright-cli click ${`getByRole('button', { name: 'Save and test' })`}`.nothrow().quiet();
await Bun.sleep(5000);
const after = await cliEval(`(() => ({
  toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0, 8),
  savedLabel: [...document.querySelectorAll('button,span,div')].some(e => /^Saved$/i.test((e.innerText||'').trim())),
  bodyHits: document.body.innerText.match(/Saved|Invalid|verified|Bot @|username|success|failed/gi)?.slice(0,12) || [],
}))()`);
console.log('global_save_test', JSON.stringify(after));

// Marketing publish dialog CTA quality
await $`bun x playwright-cli goto http://localhost:5173/org/kame-home/property/monaco-2612/marketing`.nothrow().quiet();
await Bun.sleep(2500);
await $`bun x playwright-cli click ${`getByRole('button', { name: /Publish/i })`}`.nothrow().quiet();
await Bun.sleep(1500);
const pub = await cliEval(`(() => {
  const dlg = document.querySelector('[role=dialog]');
  if (!dlg) return { err: 'no_dialog' };
  const links = [...dlg.querySelectorAll('a')].map(a => ({ text: (a.innerText||'').trim(), href: a.getAttribute('href') }));
  const btns = [...dlg.querySelectorAll('button')].map(b => (b.innerText||'').trim()).filter(Boolean);
  return { text: dlg.innerText.replace(/\\s+/g,' ').trim().slice(0,600), links, btns };
})()`);
console.log('publish_dialog', JSON.stringify(pub));
