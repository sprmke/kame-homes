import { Fingerprint } from 'lucide-react';

import type { OrgIdentityVerificationSummary } from '@/features/dashboard/super-admin/types/approval';

import { VerificationResultBadge } from './VerificationResultBadge';
import {
  IDENTITY_FLAG_LABELS,
  type IdentityFlag,
  type IdentityFlagCode,
  type IdentityVerdict,
} from '../lib/identityVerdict';

type IdentityPreScreenBlockProps = {
  summary: OrgIdentityVerificationSummary;
};

const METHOD_LABELS: Record<string, string> = {
  philsys_qr: 'PhilSys QR',
  mrz: 'Passport MRZ',
  document_ai: 'Document photo',
  provider: 'Verified provider',
};

function formatDate(value: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Reviewer pre-screen, above the document cards. Roadmap #18: the reviewer confirms
 * rather than discovers.
 */
export function IdentityPreScreenBlock({ summary }: IdentityPreScreenBlockProps) {
  const flags = summary.flags ?? [];
  const liveness =
    summary.liveness_grade === 'certified'
      ? 'Certified provider'
      : summary.liveness_grade === 'clientside'
        ? 'Device check'
        : 'Not run';

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Fingerprint className="text-muted-foreground h-4 w-4" aria-hidden />
          <span className="text-sm font-semibold">Identity check</span>
        </div>
        <VerificationResultBadge
          verdict={summary.verdict as IdentityVerdict}
          flags={flags as unknown as IdentityFlag[]}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Method</dt>
        <dd>{METHOD_LABELS[summary.method] ?? summary.method}</dd>
        <dt className="text-muted-foreground">Document</dt>
        <dd>{summary.document_type ?? 'Unknown'}</dd>
        <dt className="text-muted-foreground">Name</dt>
        <dd>{summary.full_name ?? 'Not read'}</dd>
        <dt className="text-muted-foreground">Authenticity</dt>
        <dd>{summary.signature_valid ? 'Signature verified' : 'No signature proof'}</dd>
        <dt className="text-muted-foreground">Liveness</dt>
        <dd>{liveness}</dd>
        <dt className="text-muted-foreground">Face match</dt>
        <dd>{summary.face_match_verdict ?? 'Not run'}</dd>
        <dt className="text-muted-foreground">Checked</dt>
        <dd>{formatDate(summary.verified_at ?? summary.created_at)}</dd>
        {summary.expires_at && (
          <>
            <dt className="text-muted-foreground">Expires</dt>
            <dd>{formatDate(summary.expires_at)}</dd>
          </>
        )}
      </dl>

      {flags.length > 0 && (
        <ul className="space-y-1">
          {flags.map((flag) => (
            <li key={flag.code} className="text-xs">
              <span className={flag.severity === 'blocking' ? 'text-destructive' : 'text-amber-600'}>
                {IDENTITY_FLAG_LABELS[flag.code as IdentityFlagCode] ?? flag.code}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
