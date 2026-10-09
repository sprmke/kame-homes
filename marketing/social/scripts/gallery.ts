/**
 * Writes out/index.html: every rendered piece grouped by campaign concept and feature kit,
 * with the matching caption and a copy button. Open it locally to pick what to post.
 *   bun scripts/gallery.ts            English set  → out/index.html
 *   bun scripts/gallery.ts filipino   Filipino set → out/filipino/index.html
 */
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { campaignCaptions, featureCaptions, withFooter } from './captions';
import {
  filipinoCampaignCaptions,
  filipinoFeatureCaptions,
  withFilipinoFooter,
} from './filipinoCaptions';

const FIL = process.argv[2] === 'filipino';
const OUT = FIL ? 'out/filipino' : 'out';
const caps = FIL
  ? {
      campaign: filipinoCampaignCaptions,
      feature: filipinoFeatureCaptions,
      footer: withFilipinoFooter,
      title: 'Kame Homes social library · Filipino',
      campaignLede: 'Mga post na Filipino-first. Isang idea bawat post, naka-layout sa bawat format.',
      featureLede: 'Bawat module: product ad, hook post, five-slide carousel at reel, sa Taglish.',
    }
  : {
      campaign: campaignCaptions,
      feature: featureCaptions,
      footer: withFooter,
      title: 'Kame Homes social library',
      campaignLede: 'One idea per post, each laid out for every format.',
      featureLede: 'Every module ships a product ad, a hook post, a five-slide carousel and a reel.',
    };
const ORDER = ['story', 'portrait', 'square', 'landscape', 'link', 'email'];

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const title = (slug: string) =>
  slug
    .replace(/^\d+-/, '')
    .split('-')
    .map((w) => (w === 'ai' ? 'AI' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const rank = (f: string) => {
    const base = f.replace(/\.(png|mp4)$/, '');
    const n = Number(base);
    return Number.isFinite(n) ? n : 100 + ORDER.indexOf(base) + (f.endsWith('.mp4') ? 50 : 0);
  };
  return readdirSync(dir)
    .filter((f) => /\.(png|mp4)$/.test(f))
    .sort((a, b) => rank(a) - rank(b));
}

function tiles(dir: string): string {
  return files(dir)
    .map((f) => {
      const src = join(dir, f).replace(`${OUT}/`, '');
      const label = f.replace(/\.(png|mp4)$/, (m) => (m === '.mp4' ? ' · video' : ''));
      const media = f.endsWith('.mp4')
        ? `<video src="${src}" controls preload="metadata" playsinline></video>`
        : `<img src="${src}" loading="lazy" alt="${esc(label)}">`;
      return `<figure>${media}<figcaption><span>${esc(label)}</span><a href="${src}" download>Download</a></figcaption></figure>`;
    })
    .join('');
}

function caption(text?: string): string {
  if (!text) return '';
  const full = caps.footer(text);
  return `<div class="cap"><pre>${esc(full)}</pre><button data-copy="${esc(full)}">Copy caption</button></div>`;
}

const sections: string[] = [];

const campaignDir = join(OUT, 'campaign');
const campaign = existsSync(campaignDir)
  ? readdirSync(campaignDir)
      .filter((d) => statSync(join(campaignDir, d)).isDirectory())
      .sort()
  : [];
sections.push(
  `<h2 id="campaign">Campaign</h2><p class="lede">${caps.campaignLede}</p>` +
    campaign
      .map(
        (id) =>
          `<section id="c-${id}"><h3>${id.slice(0, 2)} · ${title(id)}</h3>${caption(caps.campaign[id])}<div class="grid">${tiles(join(campaignDir, id))}</div></section>`
      )
      .join('')
);

const featDir = join(OUT, 'features');
const feats = existsSync(featDir)
  ? readdirSync(featDir)
      .filter((d) => statSync(join(featDir, d)).isDirectory())
      .sort()
  : [];
const kinds: [keyof (typeof featureCaptions)[string], string][] = [
  ['ad', 'Product ad'],
  ['hook', 'Hook post'],
  ['carousel', 'How it works carousel'],
  ['reel', 'Reel'],
];
sections.push(
  `<h2 id="features">Feature kits</h2><p class="lede">${caps.featureLede}</p>` +
    feats
      .map((slug) => {
        const fcaps = caps.feature[slug];
        const parts = kinds
          .filter(([k]) => files(join(featDir, slug, k)).length)
          .map(
            ([k, label]) =>
              `<h4>${label}</h4>${caption(fcaps?.[k])}<div class="grid">${tiles(join(featDir, slug, k))}</div>`
          )
          .join('');
        return `<section id="f-${slug}"><h3>${slug.slice(0, 2)} · ${title(slug)}</h3>${parts}</section>`;
      })
      .join('')
);

const nav = [
  ...campaign.map((id) => `<a href="#c-${id}">${title(id)}</a>`),
  '<span></span>',
  ...feats.map((s) => `<a href="#f-${s}">${title(s)}</a>`),
].join('');

const html = `<!doctype html>
<html lang="${FIL ? 'fil' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${caps.title}</title>
<style>
:root{--bg:#f4f6f5;--fg:#121a17;--sub:#4b5a55;--card:#fff;--line:#dfe5e2;--brand:#0f8a63}
@media (prefers-color-scheme:dark){:root{--bg:#111614;--fg:#eef3f1;--sub:#9aaba5;--card:#1a211e;--line:#2b3531}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:14px 16px}
header h1{margin:0 0 8px;font-size:20px;letter-spacing:-.02em}
nav{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}nav a{flex:none;font-size:13px;padding:5px 10px;border-radius:99px;background:var(--card);border:1px solid var(--line);color:var(--fg);text-decoration:none}
nav span{flex:none;width:1px;background:var(--line);margin:0 4px}
main{max-width:1400px;margin:0 auto;padding:8px 16px 80px}
h2{font-size:28px;letter-spacing:-.03em;margin:40px 0 4px}.lede{color:var(--sub);margin:0 0 12px}
section{border-top:1px solid var(--line);padding:22px 0}h3{font-size:19px;margin:0 0 10px}h4{font-size:14px;color:var(--sub);margin:18px 0 8px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;align-items:start}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
figure img,figure video{display:block;width:100%;height:auto;background:#000}
figcaption{display:flex;justify-content:space-between;gap:8px;padding:6px 10px;font-size:12px;color:var(--sub)}figcaption a{color:var(--brand)}
.cap{display:flex;gap:10px;align-items:flex-start;margin:0 0 12px}
.cap pre{flex:1;margin:0;white-space:pre-wrap;font:13px/1.45 system-ui,sans-serif;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.cap button{flex:none;font:600 13px system-ui;padding:8px 12px;border-radius:99px;border:0;background:var(--brand);color:#fff;cursor:pointer}
@media (max-width:640px){.cap{flex-direction:column}.grid{grid-template-columns:repeat(2,1fr)}}
</style></head><body>
<header><h1>${caps.title}</h1><nav>${nav}</nav></header>
<main>${sections.join('')}</main>
<script>document.addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(!b)return;navigator.clipboard.writeText(b.dataset.copy).then(()=>{b.textContent='Copied';setTimeout(()=>b.textContent='Copy caption',1200)}).catch(()=>{})})</script>
</body></html>`;

writeFileSync(join(OUT, 'index.html'), html);
console.log(
  `Wrote ${OUT}/index.html (${campaign.length} campaign concepts, ${feats.length} feature kits)`
);
