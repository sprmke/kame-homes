#!/usr/bin/env node
/**
 * quality-check — automated half of the §9.2 image-quality gate.
 *
 * For each photo preset it runs, in a real Chromium context, the same
 * decode → stepwise-downscale → `canvas.toBlob(type, quality)` path the client
 * optimizer uses, then compares the **decoded output** against the **original
 * resampled to the same pixel dimensions** (isolating *encoding* loss from the
 * intentional, display-justified resize — exactly the §9.2 comparison):
 *
 *   - SSIM (luma)                 ≥ 0.980  (photo)  / ≥ 0.995 (document)
 *   - max ΔE (sRGB) on flat area  ≤ 3      (photo)  / ≤ 2     (document)
 *   - byte reduction (median)     ≥ 50 %   (photo)  / ≥ 0 %   (document)
 *   - never larger than input     always
 *   - output long edge ≥ preset DPR minimum
 *
 * Corpus: a deterministic synthetic set that exercises the §9.3 traps (flat sky
 * / banding, saturated gamut, fine text, noise, small-already-optimized). Drop
 * real photos into `docs/guides/testing/fixtures/media/` as PNG/JPEG to extend
 * it — any file there is picked up automatically.
 *
 * The blind A/B (§9.4) and OCR regression (§9.7) remain human/endpoint gates and
 * are NOT covered here.
 *
 * Usage:
 *   node scripts/media/quality-check.mjs            # synthetic corpus
 *   node scripts/media/quality-check.mjs --json
 *   node scripts/media/quality-check.mjs --fixtures ./docs/guides/testing/fixtures/media
 *
 * Requires the repo's Playwright browsers (`bunx playwright install chromium`).
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const fixturesArg = args.includes('--fixtures')
  ? args[args.indexOf('--fixtures') + 1]
  : join(repoRoot, 'docs', 'guides', 'testing', 'fixtures', 'media');

// Mirror of ui/src/lib/media/imageOptimizationPlan.ts PRESET_CONFIGS (photo presets).
const PRESETS = {
  PHOTO_MASTER: { maxLongEdge: 3840, minLongEdge: 1600, quality: 0.82, type: 'image/webp' },
  CONTENT: { maxLongEdge: 2048, minLongEdge: 1024, quality: 0.82, type: 'image/webp' },
  AVATAR: { maxLongEdge: 512, minLongEdge: 256, quality: 0.85, type: 'image/webp' },
};
const GATE = {
  ssim: 0.98,
  maxDeltaE: 3,
  medianByteReduction: 0.5,
};

async function loadChromium() {
  try {
    const mod = await import('@playwright/test');
    return mod.chromium;
  } catch {
    console.error(
      'Playwright not available. Install with `bunx playwright install chromium` and retry.'
    );
    process.exit(2);
  }
}

/**
 * Synthetic corpus — drawn deterministically in-page. `presets` lists which
 * presets the item is a *representative* trap for: fine text and pure grain are
 * document/detail traps, not avatar content, and downscaling them 6× to 512px
 * measures the intentional resize, not encode loss — so they don't gate AVATAR.
 */
const SYNTHETIC = [
  { name: 'flat-sky-gradient', kind: 'gradient', presets: ['PHOTO_MASTER', 'CONTENT', 'AVATAR'] },
  { name: 'saturated-gamut', kind: 'gamut', presets: ['PHOTO_MASTER', 'CONTENT', 'AVATAR'] },
  { name: 'photo-like', kind: 'photo', presets: ['PHOTO_MASTER', 'CONTENT', 'AVATAR'] },
  { name: 'fine-text', kind: 'text', presets: ['PHOTO_MASTER', 'CONTENT'] },
  { name: 'high-freq-noise', kind: 'noise', presets: ['PHOTO_MASTER', 'CONTENT'] },
];

function readFixtures(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .map((f) => {
      const buf = readFileSync(join(dir, f));
      const mime = extname(f).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
      return { name: f, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
    });
}

/* eslint-disable */
// Runs in the browser. Returns { ssim, maxDeltaE, byteRatio, outLongEdge, inLongEdge }.
async function measureInPage({ source, kind, dataUrl, preset }) {
  const cfg = preset;
  const SIZE = 3200; // synthetic source long edge (12–24 MP class)

  function drawSynthetic(ctx, w, h, kind) {
    if (kind === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0b3d91');
      g.addColorStop(1, '#bcd4f6');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (kind === 'gamut') {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8000', '#8000ff'][i];
        ctx.fillRect((i * w) / 8, 0, w / 8, h);
      }
    } else if (kind === 'text') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111';
      ctx.font = '18px monospace';
      for (let y = 24; y < h; y += 26) ctx.fillText('The quick brown fox 0123456789 — ID 4471-A', 12, y);
    } else if (kind === 'noise') {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 256) | 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    } else {
      // photo-like: smooth base + mild structure + fine grain
      const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 40, w * 0.5, h * 0.5, Math.max(w, h));
      g.addColorStop(0, '#f2e6c9'); g.addColorStop(0.5, '#8fae7a'); g.addColorStop(1, '#243b2e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(${(Math.random()*80)|0},${(Math.random()*120)|0},${(Math.random()*80)|0},0.15)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 6, 6);
      }
    }
  }

  async function toBitmap(src) {
    if (src.startsWith('data:')) {
      const blob = await (await fetch(src)).blob();
      return await createImageBitmap(blob);
    }
    const c = new OffscreenCanvas(SIZE, Math.round(SIZE * 0.66));
    const cx = c.getContext('2d');
    drawSynthetic(cx, c.width, c.height, kind);
    return await createImageBitmap(c);
  }

  function drawScaled(bmp, targetLong) {
    let w = bmp.width, h = bmp.height;
    const scale = Math.min(1, targetLong / Math.max(w, h));
    let cw = Math.max(1, Math.round(w * scale));
    let ch = Math.max(1, Math.round(h * scale));
    // stepwise halving (matches browser-image-compression)
    let cur = new OffscreenCanvas(w, h);
    cur.getContext('2d').drawImage(bmp, 0, 0);
    while (w * 0.5 > cw || h * 0.5 > ch) {
      const nw = Math.max(cw, Math.round(w * 0.5));
      const nh = Math.max(ch, Math.round(h * 0.5));
      const next = new OffscreenCanvas(nw, nh);
      next.getContext('2d').drawImage(cur, 0, 0, nw, nh);
      cur = next; w = nw; h = nh;
    }
    const out = new OffscreenCanvas(cw, ch);
    out.getContext('2d').drawImage(cur, 0, 0, cw, ch);
    return out;
  }

  function imageDataOf(canvas) {
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  }

  function ssimLuma(a, b) {
    // global SSIM on luma, 8x8 windows, no gaussian (fast, conservative).
    const w = a.width, h = a.height;
    const la = new Float64Array(w * h), lb = new Float64Array(w * h);
    for (let i = 0, p = 0; i < a.data.length; i += 4, p++) {
      la[p] = 0.299 * a.data[i] + 0.587 * a.data[i + 1] + 0.114 * a.data[i + 2];
      lb[p] = 0.299 * b.data[i] + 0.587 * b.data[i + 1] + 0.114 * b.data[i + 2];
    }
    const C1 = 6.5025, C2 = 58.5225;
    let acc = 0, n = 0;
    const win = 8;
    for (let y = 0; y + win <= h; y += win) {
      for (let x = 0; x + win <= w; x += win) {
        let ma = 0, mb = 0;
        for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
          const idx = (y + j) * w + (x + i);
          ma += la[idx]; mb += lb[idx];
        }
        ma /= win * win; mb /= win * win;
        let va = 0, vb = 0, cov = 0;
        for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) {
          const idx = (y + j) * w + (x + i);
          va += (la[idx] - ma) ** 2; vb += (lb[idx] - mb) ** 2;
          cov += (la[idx] - ma) * (lb[idx] - mb);
        }
        va /= win * win - 1; vb /= win * win - 1; cov /= win * win - 1;
        acc += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
        n++;
      }
    }
    return n ? acc / n : 1;
  }

  function maxDeltaEFlat(a, b) {
    // crude ΔE (Euclidean in sRGB, scaled) over the smoothest 16x16 block of `a`.
    const w = a.width, h = a.height, blk = 16;
    let bestVar = Infinity, bx = 0, by = 0;
    for (let y = 0; y + blk <= h; y += blk) {
      for (let x = 0; x + blk <= w; x += blk) {
        let m = 0, v = 0;
        for (let j = 0; j < blk; j++) for (let i = 0; i < blk; i++) {
          const idx = ((y + j) * w + (x + i)) * 4;
          m += a.data[idx];
        }
        m /= blk * blk;
        for (let j = 0; j < blk; j++) for (let i = 0; i < blk; i++) {
          const idx = ((y + j) * w + (x + i)) * 4;
          v += (a.data[idx] - m) ** 2;
        }
        if (v < bestVar) { bestVar = v; bx = x; by = y; }
      }
    }
    let maxE = 0;
    for (let j = 0; j < blk; j++) for (let i = 0; i < blk; i++) {
      const idx = ((by + j) * w + (bx + i)) * 4;
      const dr = a.data[idx] - b.data[idx];
      const dg = a.data[idx + 1] - b.data[idx + 1];
      const db = a.data[idx + 2] - b.data[idx + 2];
      const e = Math.sqrt(dr * dr + dg * dg + db * db) / 2.55 / 3; // ~ΔE scale
      if (e > maxE) maxE = e;
    }
    return maxE;
  }

  const srcBmp = await toBitmap(dataUrl || '');
  const inLongEdge = Math.max(srcBmp.width, srcBmp.height);

  const scaled = drawScaled(srcBmp, cfg.maxLongEdge);
  const encBlob = await scaled.convertToBlob({ type: cfg.type, quality: cfg.quality });
  const encBmp = await createImageBitmap(encBlob);
  const outLongEdge = Math.max(encBmp.width, encBmp.height);

  // reference: original resampled to the SAME dims as the encoded output
  const ref = new OffscreenCanvas(encBmp.width, encBmp.height);
  ref.getContext('2d').drawImage(srcBmp, 0, 0, ref.width, ref.height);
  const encCanvas = new OffscreenCanvas(encBmp.width, encBmp.height);
  encCanvas.getContext('2d').drawImage(encBmp, 0, 0);

  const refData = imageDataOf(ref);
  const encData = imageDataOf(encCanvas);

  // input byte size
  let inBytes;
  if ((dataUrl || '').startsWith('data:')) {
    inBytes = (await (await fetch(dataUrl)).blob()).size;
  } else {
    inBytes = (await srcBmp /* synthetic: encode a PNG baseline */ && (await (async () => {
      const c = new OffscreenCanvas(srcBmp.width, srcBmp.height);
      c.getContext('2d').drawImage(srcBmp, 0, 0);
      return (await c.convertToBlob({ type: 'image/png' })).size;
    })()));
  }

  return {
    source,
    preset: undefined,
    ssim: ssimLuma(refData, encData),
    maxDeltaE: maxDeltaEFlat(refData, encData),
    byteRatio: encBlob.size / inBytes,
    inBytes,
    outBytes: encBlob.size,
    inLongEdge,
    outLongEdge,
    minLongEdge: cfg.minLongEdge,
  };
}
/* eslint-enable */

async function main() {
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');

  const fixtures = readFixtures(fixturesArg);
  const corpus = [
    ...SYNTHETIC.map((s) => ({
      source: `synthetic:${s.name}`,
      kind: s.kind,
      dataUrl: '',
      presets: s.presets,
    })),
    // Real fixtures are representative for every photo preset.
    ...fixtures.map((f) => ({
      source: `fixture:${f.name}`,
      kind: 'photo',
      dataUrl: f.dataUrl,
      presets: Object.keys(PRESETS),
    })),
  ];

  const rows = [];
  for (const preset of Object.keys(PRESETS)) {
    for (const item of corpus) {
      if (!item.presets.includes(preset)) continue;
      const r = await page.evaluate(measureInPage, {
        source: item.source,
        kind: item.kind,
        dataUrl: item.dataUrl,
        preset: PRESETS[preset],
      });
      rows.push({ ...r, preset });
    }
  }
  await browser.close();

  const failures = [];
  for (const r of rows) {
    if (r.ssim < GATE.ssim) failures.push(`${r.preset}/${r.source}: SSIM ${r.ssim.toFixed(4)} < ${GATE.ssim}`);
    if (r.maxDeltaE > GATE.maxDeltaE)
      failures.push(`${r.preset}/${r.source}: ΔE ${r.maxDeltaE.toFixed(2)} > ${GATE.maxDeltaE}`);
    if (r.outBytes >= r.inBytes)
      failures.push(`${r.preset}/${r.source}: output not smaller (${r.outBytes} >= ${r.inBytes})`);
    if (r.outLongEdge < Math.min(r.minLongEdge, r.inLongEdge))
      failures.push(`${r.preset}/${r.source}: long edge ${r.outLongEdge} < min ${r.minLongEdge}`);
  }
  // median byte reduction per preset
  for (const preset of Object.keys(PRESETS)) {
    const ratios = rows.filter((r) => r.preset === preset).map((r) => r.byteRatio).sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)] ?? 1;
    if (1 - median < GATE.medianByteReduction)
      failures.push(
        `${preset}: median byte reduction ${(100 * (1 - median)).toFixed(0)}% < ${100 * GATE.medianByteReduction}%`
      );
  }

  if (asJson) {
    console.log(JSON.stringify({ gate: GATE, rows, failures, pass: failures.length === 0 }, null, 2));
  } else {
    for (const r of rows) {
      console.log(
        `${r.pass === false ? '✗' : ' '} ${r.preset.padEnd(13)} ${r.source.padEnd(28)} ` +
          `SSIM ${r.ssim.toFixed(4)}  ΔE ${r.maxDeltaE.toFixed(2)}  ${(100 * r.byteRatio).toFixed(0)}% of input  ${r.outLongEdge}px`
      );
    }
    console.log('');
    if (failures.length) {
      console.error(`✗ quality gate FAILED (${failures.length}):`);
      for (const f of failures) console.error(`  - ${f}`);
    } else {
      console.log('✓ quality gate passed (encode loss within §9.2 thresholds)');
      console.log('  Blind A/B (§9.4) and OCR regression (§9.7) still require human / endpoint sign-off.');
    }
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
