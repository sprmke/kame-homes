#!/usr/bin/env bun
import { $ } from 'bun';

const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SRK =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const email = process.argv[2] || 'sprmke.dev@gmail.com';

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
if (!token) {
  console.error('no hashed_token', resp);
  process.exit(1);
}

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
if (!s.access_token) {
  console.error('no access_token', loc.slice(0, 200));
  process.exit(1);
}

await $`bun x playwright-cli open http://localhost:5173/`.nothrow().quiet();
await Bun.sleep(800);

const emailOut = await cliEval(`async () => {
  const s = ${JSON.stringify(s)};
  const r = await fetch('http://127.0.0.1:54321/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + s.access_token, apikey: '${ANON}' }
  });
  const user = await r.json();
  localStorage.setItem('sb-127-auth-token', JSON.stringify({ ...s, user }));
  return { email: user.email };
}`);
console.log('inject', JSON.stringify(emailOut));

await $`bun x playwright-cli reload`.nothrow().quiet();
await Bun.sleep(1200);
await $`bun x playwright-cli goto http://localhost:5173/org/kame-home/property/monaco-2612/plans`.nothrow().quiet();
await Bun.sleep(2500);

const plan = await cliEval(`(() => ({
  title: document.title,
  hits: document.body.innerText.replace(/\\s+/g,' ').match(/Business|Pro|Starter|Free|Current plan|₱[\\d,]+/g)?.slice(0,20) || [],
  snippet: document.body.innerText.replace(/\\s+/g,' ').slice(0,500)
}))()`);
console.log('plans', JSON.stringify(plan));
