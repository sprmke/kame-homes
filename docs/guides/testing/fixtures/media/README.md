# Media quality-check corpus

Drop real reference images here (PNG / JPEG) and `scripts/media/quality-check.mjs`
picks them up automatically alongside its built-in synthetic traps.

Recommended set (plan §9.3):

1. Bright landscape photo (24 MP)
2. Indoor low-light / noisy photo
3. Portrait-orientation phone photo (EXIF rotation)
4. Photo with large flat sky (banding trap)
5. Highly saturated reds/greens (gamut trap)
6. Fine-text screenshot
7. Scanned document (dense text)
8. Phone photo of a paper receipt (skew, shadow)
9. Photo of an ID card (small serials) — use a **fake / sample** ID, never real PII
10. PNG logo with transparency
11. Already-small 60 KB JPEG (skip-guard)
12. HEIC from an iPhone
13. Animated GIF
14. 50 MP DSLR JPEG (memory trap)
15. Grayscale document

**Never commit real guest PII** (real IDs, real receipts with names/numbers). Use
synthetic or sample documents. Large binaries: prefer Git LFS or keep the set small.

Run: `node scripts/media/quality-check.mjs` (or `--json`). Requires the repo's
Playwright Chromium (`bunx playwright install chromium`).
