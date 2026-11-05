# Screenshots

Portfolio images for the root [README](../../README.md). Captured from [kamespace.com](https://kamespace.com) at 1440×900 (dark).

| File                    | View                        |
| ----------------------- | --------------------------- |
| `logo.png`              | App icon                    |
| `landing-hero.png`      | Guest home / search         |
| `properties.png`        | Property browse             |
| `property-listing.png`  | Listing detail              |
| `property-calendar.png` | Guest availability calendar |
| `for-hosts.png`         | Host marketing landing      |
| `for-hosts-tour.png`    | Narrated product tour       |
| `pricing.png`           | Public host plans           |
| `sign-in.png`           | Host sign-in                |
| `host-dashboard.png`    | Property dashboard (tour)   |
| `host-bookings.png`     | Booking workflow (tour)     |
| `host-board.png`        | Bookings board (tour)       |
| `host-inbox.png`        | Guest Inbox (tour)          |
| `host-pricing.png`      | Pricing calendar (tour)     |
| `host-finance.png`      | Finance (tour)              |

## Regenerate

With network access:

```bash
bun scripts/dev/capture-readme-screenshots.mjs
bun scripts/dev/capture-readme-extra.mjs
bun scripts/dev/capture-readme-tour-chapters.mjs
```

Host app frames come from the public `/for-hosts` product tour (no host login required). Public guest pages are live captures from production.
