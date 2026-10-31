import {
  orgPortfolioListingKind,
  orgPortfolioListingName,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function orgPortfolioRowsToCsv(rows: OrgPortfolioRow[]): string {
  const header = [
    'Kind',
    'Listing',
    'Occupancy %',
    'Avg nightly rate',
    'Revenue per night',
    'Revenue',
    'Bookings',
    'Cancellation %',
    'Outlook',
    'Forward occupancy %',
  ];
  const lines = rows.map((row) => {
    const kind = orgPortfolioListingKind(row);
    const name = orgPortfolioListingName(row);
    if (row.locked) {
      return [kind, name, 'Locked', '', '', '', '', '', '', ''].map(csvEscape).join(',');
    }
    return [
      kind,
      name,
      row.occupancyRate,
      row.adr,
      row.revpar,
      row.grossRevenue,
      row.reservations,
      row.cancellationRate,
      row.forwardOccupancyState30d,
      row.forwardOccupancyRate30d ?? '',
    ]
      .map(csvEscape)
      .join(',');
  });
  return [header.map(csvEscape).join(','), ...lines].join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
