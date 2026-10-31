import dayjs from 'dayjs';

/** ISO `YYYY-MM-DD` (or ISO timestamp) → e.g. `July 6, 2026` (Asia/Manila calendar day). */
export function formatTeamInvitationDate(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim();
  if (!raw) return '';
  const d = dayjs(raw.slice(0, 10), 'YYYY-MM-DD', true);
  if (!d.isValid()) return raw;
  return d.format('MMMM D, YYYY');
}
