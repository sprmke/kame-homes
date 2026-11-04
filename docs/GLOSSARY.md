# Glossary

Product vocabulary for **Kame Space**. Keep this short and current; it is the reference agents and teammates should use when a name is ambiguous.

## Product names

| Term           | Meaning                                                     | Use it for                                                                                                                                                      |
| -------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kame Space** | The product.                                                | Everything a guest, host, teammate or third party reads: UI, emails, PDFs, docs, listings.                                                                      |
| **Kame**       | Short name, and the name of the mascot and AI receptionist. | Short labels ("vs Kame median"), the receptionist persona, component names such as `Kame*`. Never as a replacement for "Kame Space" in a full product sentence. |
| **Kame Homes** | The product's name before November 2026.                    | Only in historical records, archived docs, legal disclosure ("previously called Kame Homes") and the `alternateName` SEO hint. Never in new copy.               |

## Casing

| Context         | Form             |
| --------------- | ---------------- |
| Display         | `Kame Space`     |
| Wordmark        | `Kame` + `Space` |
| Uppercase       | `KAME SPACE`     |
| Slug / kebab    | `kame-space`     |
| PascalCase      | `KameSpace`      |
| camelCase       | `kameSpace`      |
| SCREAMING_SNAKE | `KAME_SPACE`     |
| Hashtag         | `#KameSpace`     |
| Handle          | `kamespace`      |

## Stable identifiers that keep the old name

These are technical names, not branding. Changing them breaks links, data or calendars, so they are allow-listed in `scripts/brand/brand-allowlist.txt`.

- Repository `sprmke/kame-space` (the old `kame-homes` URL redirects).
- Local seed tenant slugs `kame-homes` / `kame-home`.
- Guest trip calendar `UID:trip-<id>@kamehomes`.
- Default GCash QR asset `kame-home-gcash-qr-payment.jpg`.
- Legacy host map (`kamehomes.space`, `www`, `app`) used for 308 redirects.
- Shipped migrations under `supabase/migrations/`.
- Historical records: `activity_log`, sent-email logs, chat transcripts, reviews.

## Related

- Brand rules and the rename plan: [`workflow/done/kamespace-03-rebrand-kame-homes-to-kame-space.md`](./workflow/done/kamespace-03-rebrand-kame-homes-to-kame-space.md)
- Visual system: [`../DESIGN.md`](../DESIGN.md)
