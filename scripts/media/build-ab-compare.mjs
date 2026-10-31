#!/usr/bin/env node
/**
 * build-ab-compare — generates the throwaway blind-A/B compare page (plan §9.4).
 *
 * Produces a single self-contained HTML file: for each image in the fixtures
 * dir it embeds the original, re-encodes it in-page with the same
 * decode → stepwise-downscale → `canvas.toBlob(type, quality)` path each photo
 * preset uses, then shows the two **at 100% zoom and fit-to-screen**, labels
 * hidden, left/right randomized. Reviewers mark, per pair: "which is the
 * original?" and "does either look degraded?" — the page exports a CSV of
 * verdicts to paste into the sign-off table in
 * `docs/guides/testing/image-upload-optimization-manual.md` §2.
 *
 * Usage:
 *   node scripts/media/build-ab-compare.mjs \
 *     --fixtures docs/guides/testing/fixtures/media \
 *     --preset PHOTO_MASTER \
 *     --out tmp/ab-compare.html
 *
 * Open the file on a 4K-or-better display. Nothing here is a substitute for the
 * human judgement — it is only the tooling the plan asks for.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (flag, def) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : def);

const fixturesDir = opt('--fixtures', join(repoRoot, 'docs/guides/testing/fixtures/media'));
const preset = opt('--preset', 'PHOTO_MASTER');
const outPath = opt('--out', join(repoRoot, 'tmp', 'ab-compare.html'));

const PRESETS = {
  PHOTO_MASTER: { maxLongEdge: 3840, quality: 0.82, type: 'image/webp' },
  CONTENT: { maxLongEdge: 2048, quality: 0.82, type: 'image/webp' },
  AVATAR: { maxLongEdge: 512, quality: 0.85, type: 'image/webp' },
};
if (!PRESETS[preset]) {
  console.error(`--preset must be one of ${Object.keys(PRESETS).join(', ')}`);
  process.exit(2);
}
if (!existsSync(fixturesDir)) {
  console.error(`No fixtures dir at ${fixturesDir} — add reference photos first (see its README).`);
  process.exit(2);
}

const files = readdirSync(fixturesDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (files.length === 0) {
  console.error(`No images in ${fixturesDir}. Add PNG/JPEG reference photos (plan §9.3).`);
  process.exit(2);
}

const items = files.map((f) => {
  const buf = readFileSync(join(fixturesDir, f));
  const mime = extname(f).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  return { name: f, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
});

const cfg = PRESETS[preset];
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Blind A/B — ${preset}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #111; color: #eee; font: 14px/1.5 system-ui, sans-serif; }
  header { position: sticky; top: 0; background: #000; padding: 12px 16px; border-bottom: 1px solid #333; z-index: 5; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  .pair { border-bottom: 1px solid #333; padding: 16px; }
  .stage { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .stage figure { margin: 0; background: #000; overflow: auto; max-height: 80vh; border: 1px solid #333; }
  .stage img { display: block; }
  .fit .stage img { width: 100%; height: auto; }
  .controls { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
  button, select { background: #222; color: #eee; border: 1px solid #444; border-radius: 6px; padding: 6px 10px; font: inherit; cursor: pointer; }
  .done { opacity: .5; }
  code { background: #000; padding: 1px 4px; border-radius: 3px; }
</style></head><body>
<header>
  <h1>Blind A/B — preset <code>${preset}</code> · ${items.length} pairs</h1>
  <div class="controls">
    <button id="mode">Toggle 100% / fit</button>
    <button id="export">Export verdicts CSV</button>
    <span id="progress"></span>
  </div>
  <div>For each pair pick which side is the <b>original</b>, and flag if <b>either</b> looks degraded. Sides are randomized and hidden until you answer.</div>
</header>
<main id="main"></main>
<script>
const ITEMS = ${JSON.stringify(items)};
const CFG = ${JSON.stringify(cfg)};
const verdicts = [];

async function bitmap(src){ return createImageBitmap(await (await fetch(src)).blob()); }

async function optimize(src){
  const bmp = await bitmap(src);
  let w = bmp.width, h = bmp.height;
  const scale = Math.min(1, CFG.maxLongEdge / Math.max(w,h));
  const cw = Math.max(1, Math.round(w*scale)), ch = Math.max(1, Math.round(h*scale));
  let cur = new OffscreenCanvas(w,h); cur.getContext('2d').drawImage(bmp,0,0);
  while (w*0.5 > cw || h*0.5 > ch){
    const nw = Math.max(cw, Math.round(w*0.5)), nh = Math.max(ch, Math.round(h*0.5));
    const nx = new OffscreenCanvas(nw,nh); nx.getContext('2d').drawImage(cur,0,0,nw,nh);
    cur = nx; w = nw; h = nh;
  }
  const out = new OffscreenCanvas(cw,ch); out.getContext('2d').drawImage(cur,0,0);
  const blob = await out.convertToBlob({ type: CFG.type, quality: CFG.quality });
  return URL.createObjectURL(blob);
}

function progress(){ document.getElementById('progress').textContent = verdicts.length + ' / ' + ITEMS.length + ' answered'; }

(async () => {
  const main = document.getElementById('main');
  for (let i=0;i<ITEMS.length;i++){
    const it = ITEMS[i];
    const optUrl = await optimize(it.dataUrl);
    const originalLeft = Math.random() < 0.5;
    const left = originalLeft ? it.dataUrl : optUrl;
    const right = originalLeft ? optUrl : it.dataUrl;

    const el = document.createElement('section');
    el.className = 'pair';
    el.innerHTML =
      '<div class="stage"><figure><img src="'+left+'"></figure><figure><img src="'+right+'"></figure></div>'+
      '<div class="controls">'+
      '<b>#'+(i+1)+' '+it.name+'</b>'+
      '<label>Original is: <select data-k="pick"><option value="">—</option><option value="L">Left</option><option value="R">Right</option><option value="cant">Can\\'t tell</option></select></label>'+
      '<label>Degraded: <select data-k="deg"><option value="none">neither</option><option value="L">left</option><option value="R">right</option><option value="both">both</option></select></label>'+
      '</div>';
    main.appendChild(el);

    const record = () => {
      const pick = el.querySelector('[data-k=pick]').value;
      const deg = el.querySelector('[data-k=deg]').value;
      if (!pick) return;
      const correct = pick === 'cant' ? 'cant' : (pick === (originalLeft ? 'L' : 'R'));
      const idx = verdicts.findIndex(v => v.i === i);
      const row = { i, name: it.name, preset: '${preset}', identifiedOriginal: correct, degraded: deg };
      if (idx >= 0) verdicts[idx] = row; else verdicts.push(row);
      el.classList.add('done');
      progress();
    };
    el.querySelectorAll('select').forEach(s => s.addEventListener('change', record));
  }
  progress();
})();

document.getElementById('mode').addEventListener('click', () => document.body.classList.toggle('fit'));
document.getElementById('export').addEventListener('click', () => {
  const head = 'idx,name,preset,identified_original,degraded\\n';
  const body = verdicts.sort((a,b)=>a.i-b.i).map(v => [v.i+1, v.name, v.preset, v.identifiedOriginal, v.degraded].join(',')).join('\\n');
  const blob = new Blob([head+body], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'ab-verdicts-${preset}.csv'; a.click();
});
</script></body></html>`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(`✓ wrote ${outPath} (${items.length} pairs, preset ${preset}).`);
console.log('  Open it on a 4K+ display, answer every pair, export the CSV into');
console.log('  docs/guides/testing/image-upload-optimization-manual.md §2.');
console.log('  Gate: no reviewer reliably identifies the optimized image, and zero "degraded" marks.');
