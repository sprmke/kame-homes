/**
 * legacyFinanceCount.ts — finance_line_items row count from a Phase 0.1 inventory JSON.
 *
 * Usage: bun legacyFinanceCount.ts <inventory.json>
 * Prints the count to stdout (empty if missing).
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) process.exit(0);

const inv = JSON.parse(readFileSync(path, 'utf8')).results as Record<string, unknown[]>;
const key = Object.keys(inv).find((k) => k.endsWith('table_name,row_count,size_bytes'));
if (!key) process.exit(0);

const rows = inv[key] as { table_name: string; row_count: number }[];
const row = rows.find((r) => r.table_name === 'finance_line_items');
if (row) console.log(String(row.row_count));
