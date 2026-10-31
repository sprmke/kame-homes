#!/usr/bin/env bun
import { $ } from 'bun';

async function cliEval(js) {
  const out = await $`bun x playwright-cli eval ${js}`.nothrow().text();
  const m = out.match(/### Result\n([\s\S]*?)\n### Ran/);
  if (!m) return { error: 'no_result', snippet: out.slice(-600) };
  try {
    return JSON.parse(m[1].trim());
  } catch {
    return { raw: m[1].trim().slice(0, 1200) };
  }
}

const BASE = 'http://localhost:5173/org/kame-home/property/monaco-2612';

console.log('=== TELEGRAM ===');
await $`bun x playwright-cli goto ${`${BASE}/notifications`}`.nothrow().quiet();
await Bun.sleep(2500);
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Chat' })`}`.nothrow().quiet();
await Bun.sleep(1500);

let snap = await cliEval(`(() => {
  const text = document.body.innerText.replace(/\\s+/g,' ').trim();
  const btns = [...document.querySelectorAll('button')].map(b => (b.innerText||'').replace(/\\s+/g,' ').trim()).filter(t => /Connect|Save|Scan|Reveal|Enable|test|Manage|How to/i.test(t)).slice(0,30);
  const connected = /Telegram connected|Connected/i.test(text);
  const failed = /Connection failed|Invalid bot/i.test(text);
  return { connected, failed, btns, hasChatId: /Chat ID/i.test(text), snippet: text.match(/Chat[\\s\\S]{0,400}/)?.[0]?.slice(0,400) || text.slice(0,400) };
})()`);
console.log('chat_module', JSON.stringify(snap));

// Click Connect if available (re-verify existing credentials) — avoid logging secrets
const connectOut = await $`bun x playwright-cli click ${`getByRole('button', { name: /^Connect$/ })`}`.nothrow().text();
console.log('connect_click', /Ran Playwright|Error|strict mode/i.test(connectOut) ? connectOut.match(/Error[\s\S]{0,200}|### Ran[\s\S]{0,120}|strict mode[\s\S]{0,120}/)?.[0] : 'ok');
await Bun.sleep(3500);

snap = await cliEval(`(() => {
  const toasts = [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0,8);
  const text = document.body.innerText.replace(/\\s+/g,' ');
  return {
    toasts,
    connected: /Telegram connected|\\bConnected\\b/i.test(text),
    failed: /Connection failed|Invalid bot/i.test(text),
    statusBits: text.match(/Connected|Connection failed|Scan for chats|Invalid|verified|sent|test message/gi)?.slice(0,15) || [],
  };
})()`);
console.log('after_connect', JSON.stringify(snap));

// Shared bot Save and test if visible
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Save and test' })`}`.nothrow().quiet();
await Bun.sleep(3000);
snap = await cliEval(`(() => ({
  toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0,8),
  saved: /\\bSaved\\b/i.test(document.body.innerText),
}))()`);
console.log('save_and_test', JSON.stringify(snap));

// Try Manage dialog for richer connect UX
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Manage' })`}`.nothrow().quiet();
await Bun.sleep(1500);
snap = await cliEval(`(() => {
  const dlg = document.querySelector('[role=dialog]');
  return {
    dialog: dlg ? dlg.innerText.replace(/\\s+/g,' ').trim().slice(0,700) : null,
    btns: dlg ? [...dlg.querySelectorAll('button')].map(b => (b.innerText||'').trim()).filter(Boolean).slice(0,20) : [],
  };
})()`);
console.log('manage_dialog', JSON.stringify(snap));
// close dialog
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Close' })`}`.nothrow().quiet();
await Bun.sleep(500);

console.log('=== META INBOX ===');
await $`bun x playwright-cli goto ${`${BASE}/inbox`}`.nothrow().quiet();
await Bun.sleep(2500);
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Channels' })`}`.nothrow().quiet();
await Bun.sleep(1200);
snap = await cliEval(`(() => {
  const dlg = [...document.querySelectorAll('[role=dialog]')].map(e => e.innerText.replace(/\\s+/g,' ').trim().slice(0,500));
  return { dlg, hasConnect: /Connect Meta/i.test(document.body.innerText), hasUpgrade: /Upgrade to Business/i.test(document.body.innerText) };
})()`);
console.log('channels', JSON.stringify(snap));

// Capture navigation on Connect Meta without completing Facebook login
await $`bun x playwright-cli click ${`getByRole('button', { name: 'Connect Meta' })`}`.nothrow().quiet();
await Bun.sleep(2500);
snap = await cliEval(`(() => {
  const dlgs = [...document.querySelectorAll('[role=dialog]')].map(e => e.innerText.replace(/\\s+/g,' ').trim().slice(0,400));
  return {
    url: location.href.slice(0, 200),
    host: location.host,
    isFacebook: /facebook\\.com|meta\\.com/i.test(location.href),
    dlgs,
    toasts: [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0,6),
  };
})()`);
console.log('after_connect_meta', JSON.stringify(snap));

// If redirected to facebook, note and go back; if still on app with upgrade — fail
if (snap.isFacebook || /facebook|meta\.com/i.test(snap.url || '')) {
  console.log('META_OAUTH_REDIRECT_OK');
  await $`bun x playwright-cli goto ${`${BASE}/inbox`}`.nothrow().quiet();
  await Bun.sleep(1500);
}

console.log('=== MARKETING PUBLISH ===');
await $`bun x playwright-cli goto ${`${BASE}/marketing`}`.nothrow().quiet();
await Bun.sleep(3000);
snap = await cliEval(`(() => {
  const btns = [...document.querySelectorAll('button,a')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim()).filter(t => /Publish|Download|Design|Upgrade|Meta|Business/i.test(t)).slice(0,25);
  return { title: document.title, btns, snippet: document.body.innerText.replace(/\\s+/g,' ').slice(0,350) };
})()`);
console.log('marketing', JSON.stringify(snap));

await $`bun x playwright-cli click ${`getByRole('button', { name: /Publish/i })`}`.nothrow().quiet();
await Bun.sleep(2000);
snap = await cliEval(`(() => {
  const dlgs = [...document.querySelectorAll('[role=dialog]')].map(e => e.innerText.replace(/\\s+/g,' ').trim().slice(0,800));
  const toasts = [...document.querySelectorAll('[data-sonner-toast]')].map(t => t.innerText.trim()).slice(0,8);
  return { dlgs, toasts, url: location.href };
})()`);
console.log('publish_click', JSON.stringify(snap));
