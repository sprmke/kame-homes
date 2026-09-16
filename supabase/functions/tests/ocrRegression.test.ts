/**
 * OCR / approval-accuracy regression gate for the `DOCUMENT` preset (plan §9.7).
 *
 * IDs and receipts feed `validate-booking-receipts` (Gemini/Groq vision) and
 * human approval emails. Before `DOCUMENT` optimization is enabled in prod we
 * must prove field-level extraction accuracy is **unchanged (±0 regressions)**.
 *
 * For every image in $OCR_CORPUS_DIR this test:
 *   1. runs the real `validateReceiptFile` / `validateValidIdFile` on the raw
 *      original,
 *   2. re-encodes it exactly as the client `DOCUMENT` preset would — pass through
 *      when already within 3000px + 12 MB, else resize to a 3000px long edge and
 *      re-encode near-lossless keeping the source format (JPEG q0.90 / PNG),
 *   3. runs the validator again on the re-encoded bytes,
 *   4. fails if the optimized run drops ANY field the original run extracted, or
 *      flips the verdict.
 *
 * Because `DOCUMENT` is pass-through for the common case, most of a real corpus
 * won't be re-encoded at all — this gate mainly guards the > 12 MB / > 3000px
 * branch.
 *
 * Run (local or staging stack — NEVER prod, and never commit real guest PII):
 *
 *   OCR_CORPUS_DIR=./tmp/ocr-corpus \
 *   GEMINI_API_KEY=... GROQ_API_KEY=... \
 *   deno test --allow-read --allow-env --allow-net \
 *     supabase/functions/tests/ocrRegression.test.ts
 *
 * corpus/expected.json (optional, tightens the gate):
 *   { "receipt-01.jpg": { "amount": "2799.00", "date": "2026-01-04",
 *                          "reference": "1234567890", "verdict": "valid" } }
 */

import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decode, Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

import {
  validateReceiptFile,
  validateValidIdFile,
  type ReceiptValidationResult,
} from '../_shared/receiptValidationService.ts';
import { copyBytes } from '../_shared/utils.ts';

const CORPUS = Deno.env.get('OCR_CORPUS_DIR');
const DOC_MAX_LONG_EDGE = 3000;
const DOC_CEILING_BYTES = 12 * 1024 * 1024;
const DOC_JPEG_QUALITY = 90;

/** Signals that must not regress after DOCUMENT re-encode. */
type Signals = {
  has_amount: boolean;
  has_date: boolean;
  has_reference: boolean;
  extracted_amount: string;
  extracted_date: string;
  verdict: string;
};

function signalsOf(r: ReceiptValidationResult): Signals {
  return {
    has_amount: Boolean(r.has_amount),
    has_date: Boolean(r.has_date),
    has_reference: Boolean(r.has_reference),
    extracted_amount: r.extracted_amount == null ? '' : String(r.extracted_amount),
    extracted_date: r.extracted_date == null ? '' : String(r.extracted_date),
    verdict: String(r.verdict ?? '').toLowerCase(),
  };
}

const BOOL_SIGNALS = ['has_amount', 'has_date', 'has_reference'] as const;
const VALUE_SIGNALS = ['extracted_amount', 'extracted_date'] as const;

async function reencodeDocument(
  bytes: Uint8Array,
  mime: string
): Promise<{ bytes: Uint8Array; mime: string }> {
  const withinCeiling = bytes.byteLength <= DOC_CEILING_BYTES;
  const img = (await decode(bytes)) as Image;
  const longEdge = Math.max(img.width, img.height);
  if (longEdge <= DOC_MAX_LONG_EDGE && withinCeiling) {
    return { bytes, mime }; // pass-through — matches the optimizer's skip-guard
  }
  const scale = Math.min(1, DOC_MAX_LONG_EDGE / longEdge);
  img.resize(
    Math.max(1, Math.round(img.width * scale)),
    Math.max(1, Math.round(img.height * scale))
  );
  if (mime === 'image/png') {
    return { bytes: await img.encode(), mime: 'image/png' };
  }
  return { bytes: await img.encodeJPEG(DOC_JPEG_QUALITY), mime: 'image/jpeg' };
}

function isValidId(name: string): boolean {
  return /(^|[-_])id([-_]|\d|\.)/i.test(name) || /valid[-_]?id/i.test(name);
}

Deno.test({
  name: 'DOCUMENT optimization does not regress receipt / ID extraction (§9.7)',
  ignore: !CORPUS,
  async fn(t) {
    let expected: Record<string, Record<string, string>> = {};
    try {
      expected = JSON.parse(await Deno.readTextFile(`${CORPUS}/expected.json`));
    } catch {
      expected = {};
    }

    const regressions: string[] = [];
    for await (const entry of Deno.readDir(CORPUS!)) {
      if (!entry.isFile || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
      const name = entry.name;
      const raw = await Deno.readFile(`${CORPUS}/${name}`);
      const mime = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const run = isValidId(name) ? validateValidIdFile : validateReceiptFile;

      await t.step(name, async () => {
        const before = await run(new File([raw], name, { type: mime }));
        const opt = await reencodeDocument(raw, mime);
        const after = await run(
          new File(
            [copyBytes(opt.bytes)],
            name.replace(/\.\w+$/, opt.mime === 'image/png' ? '.png' : '.jpg'),
            {
              type: opt.mime,
            }
          )
        );

        const sb = signalsOf(before);
        const sa = signalsOf(after);
        const gold = expected[name];

        // A boolean signal must not go true → false; a value the original read
        // must not disappear or change; the verdict must not flip.
        for (const f of BOOL_SIGNALS) {
          if (sb[f] && !sa[f]) regressions.push(`${name}: lost "${f}"`);
        }
        for (const f of VALUE_SIGNALS) {
          const want = gold ? String(gold[f.replace('extracted_', '')] ?? gold[f] ?? '') : sb[f];
          const beforeRight = gold ? sb[f] === want : sb[f] !== '';
          const afterRight = gold ? sa[f] === want : sa[f] === sb[f];
          if (beforeRight && !afterRight)
            regressions.push(`${name}: "${f}" ${sb[f] || '∅'} → ${sa[f] || '∅'}`);
        }
        if (sb.verdict && sa.verdict && sb.verdict !== sa.verdict) {
          regressions.push(`${name}: verdict ${sb.verdict} → ${sa.verdict}`);
        }

        const changed = opt.bytes !== raw;
        console.log(
          `  ${name}  ${changed ? 're-encoded' : 'passed through'}  ` +
            `before[${BOOL_SIGNALS.filter((f) => sb[f]).length}/3]  after[${BOOL_SIGNALS.filter((f) => sa[f]).length}/3]  ` +
            `verdict ${sb.verdict || '?'}→${sa.verdict || '?'}`
        );
      });
    }

    assert(
      regressions.length === 0,
      `OCR regression gate FAILED (${regressions.length}):\n  ${regressions.join('\n  ')}`
    );
  },
});
