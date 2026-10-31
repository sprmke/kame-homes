---
title: 'Finance & maintenance PDF export polish'
status: active
tags: [workflow, done, finance, maintenance, pdf]
updated: 2026-08-27
stage: done
kind: reference
---

# Finance & maintenance PDF export polish (shipped)

Statement-style client-side PDF redesign for **Finance** and **Maintenance** export menus (all export types). Shared layout in `ui/src/lib/pdf/*`.

## Shipped (2026-08-27)

| Area                     | Change                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Shared PDF system**    | `pdfTheme.ts`, `pdfReportLayout.ts`, `pdfFonts.ts`, `pdfFormatters.ts`, `pdfScopeLabel.ts`, `pdfStatusColors.ts`, `pdfFinanceTotals.ts`                                 |
| **Typography**           | Real Plus Jakarta Sans static cuts (Regular / SemiBold / Bold / ExtraBold); masthead + hero use ExtraBold; section titles Bold; fixed duplicate Regular-as-SemiBold bug |
| **Masthead**             | `{Report Type} - {tower/unit}` title + `Date Range: …` subtitle in card; no export timestamp or module label                                                            |
| **Tables**               | White header/footer cells matching body rows; bold totals with column alignment; status + money semantic colors (app badge tones, green/red/amber)                      |
| **Finance stays**        | Combined Host net footer total (`est` when pipeline stays included); Rate/Fees/Host net column totals; section spacing                                                  |
| **Finance transactions** | Bordered KPI cards (Income / Expenses / Net); table foot shows net only                                                                                                 |
| **Maintenance**          | Same masthead/KPI/table patterns; category + count + notes left-aligned                                                                                                 |
| **Demo data**            | `scripts/dev/seed-monaco-2612-demo-data.sql` + `bun run seed:monaco-2612` for local export QA                                                                           |
| **Route guides**         | `docs/guides/routes/org/property/finance.md`, `maintenance.md`                                                                                                          |

## Export types (unchanged menu)

| Module      | Options                                           |
| ----------- | ------------------------------------------------- |
| Finance     | Full report, Overview, Stays ledger, Transactions |
| Maintenance | Full report, Overview, Reminders list             |

Filenames: `kame-finance-*_{from}_{to}.pdf`, `kame-maintenance-*_{from}_{to}.pdf`.

## Implementation map

| Piece              | Path                                                              |
| ------------------ | ----------------------------------------------------------------- |
| Shared layout      | `ui/src/lib/pdf/pdfReportLayout.ts`, `pdfTheme.ts`, `pdfFonts.ts` |
| Status colors      | `ui/src/lib/pdf/pdfStatusColors.ts`                               |
| Stay totals        | `ui/src/lib/pdf/pdfFinanceTotals.ts`                              |
| Finance export     | `ui/src/features/dashboard/finance/lib/exportPdf.ts`              |
| Maintenance export | `ui/src/features/dashboard/maintenance/lib/exportPdf.ts`          |
| Export menus       | `FinanceExportMenu.tsx`, `MaintenanceExportMenu.tsx`              |
| Local seed         | `scripts/dev/seed-monaco-2612-demo-data.sql`                      |

## QA (local)

```bash
bun run seed:monaco-2612   # optional — rich Aug 2026 demo for kame-home / monaco-2612
./dev.sh --ui-only
# Finance: /org/kame-home/property/monaco-2612/finance?from=2026-08-01&to=2026-08-31 → Export report
# Maintenance: /org/kame-home/property/monaco-2612/maintenance?from=2026-08-01&to=2026-08-31 → Export report
```

## Plan gating (unchanged)

Starter+ **`financeReporting`** / **`maintenanceReporting`** — client export menu + server check on legacy `finance-export` only.
