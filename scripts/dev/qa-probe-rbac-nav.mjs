#!/usr/bin/env bun
import { $ } from 'bun';

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SRK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const BASE = 'http://localhost:5173/org/kame-home/property/monaco-2612';

async function cliEval(js) {
  const out = await $`bun x playwright-cli eval ${js}`.nothrow().text();
  const m = out.match(/### Result\n([\s\S]*?)\n### Ran/);
  if (!m) return { error: 'no_result', snippet: out.slice(-500) };
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return { raw: m[1].trim() };
  }
}

async function injectEmail(email) {
  const resp = await fetch('http://127.0.0.1:54321/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const token = resp.hashed_token;
  const verify = await fetch(
    `http://127.0.0.1:54321/auth/v1/verify?token=${token}&type=magiclink`,
    { headers: { apikey: ANON }, redirect: 'manual' }
  );
  const loc = verify.headers.get('location') || '';
  const h = new URLSearchParams(loc.split('#')[1] || '');
  const s = {
    access_token: h.get('access_token'),
    refresh_token: h.get('refresh_token'),
    expires_at: Number(h.get('expires_at')),
    expires_in: Number(h.get('expires_in')),
    token_type: 'bearer',
  };
  if (!s.access_token) throw new Error(`no token for ${email}`);
  await $`bun x playwright-cli goto http://localhost:5173/`.nothrow().quiet();
  const emailOut = await cliEval(`async () => {
    const s = ${JSON.stringify(s)};
    const r = await fetch('http://127.0.0.1:54321/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + s.access_token, apikey: '${ANON}' }
    });
    const user = await r.json();
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ ...s, user }));
    return user.email;
  }`);
  await $`bun x playwright-cli reload`.nothrow().quiet();
  await Bun.sleep(1200);
  return emailOut;
}

async function probe(label) {
  await $`bun x playwright-cli goto ${`${BASE}/bookings`}`.nothrow().quiet();
  await Bun.sleep(2500);
  const nav = await cliEval(`(() => {
    const links = [...document.querySelectorAll('nav a, aside a, [data-sidebar] a')].map(a => (a.innerText||'').replace(/\\s+/g,' ').trim()).filter(Boolean);
    const interesting = ['Dashboard','Bookings','Finance','Pricing','Maintenance','Marketing','Inbox','Notifications','Templates','Public Pages','Team','Settings','Help'];
    const present = Object.fromEntries(interesting.map(n => [n, links.some(t => t===n || t.startsWith(n))]));
    return { label: ${JSON.stringify(label)}, present, allNav: [...new Set(links)].slice(0,30), title: document.title };
  })()`);
  console.log(JSON.stringify(nav));

  const routes = {};
  for (const path of ['finance', 'settings', 'team', 'marketing', 'bookings']) {
    await $`bun x playwright-cli goto ${`${BASE}/${path}`}`.nothrow().quiet();
    await Bun.sleep(1800);
    routes[path] = await cliEval(`(() => ({
      path: location.pathname,
      title: document.title,
      denied: /don.t have access|not authorized|forbidden|no access|permission|you need/i.test(document.body.innerText),
      hit: (document.body.innerText.match(/don.t have|not authorized|forbidden|No access|permission|Finance|Settings|Team|Marketing|Bookings/i)||[])[0] || null
    }))()`);
  }
  console.log(JSON.stringify({ label, routes }));
  return { nav, routes };
}

const mode = process.argv[2] || 'readonly';
if (mode === 'ops') {
  console.log('auth', await injectEmail('qa-ops-monaco@example.com'));
  await probe('ops');
} else if (mode === 'readonly') {
  console.log('auth', await injectEmail('qa-readonly-monaco@example.com'));
  await probe('readonly');
} else if (mode === 'owner') {
  console.log('auth', await injectEmail('sprmke.dev@gmail.com'));
  await probe('owner');
} else {
  console.log('usage: ops|readonly|owner');
}
