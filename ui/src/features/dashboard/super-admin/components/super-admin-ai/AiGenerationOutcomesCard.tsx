import type { SuperAdminAiUsage } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const FAILURE_LABELS: Record<string, string> = {
  safety_blocked: 'Blocked',
  provider_error: 'Provider error',
  invalid_output: 'Bad output',
  timeout: 'Timed out',
};

function formatSeconds(s: number | null): string {
  if (s == null) return '-';
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AiGenerationOutcomesCard({
  summary,
}: {
  summary: NonNullable<SuperAdminAiUsage['marketingGenerations']>;
}) {
  if (summary.rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-section-title">Marketing Studio jobs</h2>
        {summary.unbilledCompleted > 0 ? (
          <Badge variant="destructive">{summary.unbilledCompleted} unbilled</Badge>
        ) : null}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Jobs</TableHead>
                <TableHead>Success</TableHead>
                <TableHead className="hidden md:table-cell">Failed</TableHead>
                <TableHead className="hidden md:table-cell">Blocked</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead className="hidden md:table-cell">Spend</TableHead>
                <TableHead>p50</TableHead>
                <TableHead className="hidden md:table-cell">p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((r) => (
                <TableRow key={`${r.mediaType}-${r.qualityTier}-${r.resolution ?? ''}`}>
                  <TableCell className="font-medium">
                    {capitalize(r.mediaType)} · {capitalize(r.qualityTier)}
                    {r.resolution ? ` · ${r.resolution}` : ''}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.total}</TableCell>
                  <TableCell className="tabular-nums">{r.successRatePct}%</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{r.failed}</TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">{r.blocked}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.credits.toLocaleString('en-US')}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    ${r.costUsd.toFixed(2)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatSeconds(r.renderP50Seconds)}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {formatSeconds(r.renderP95Seconds)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      {summary.failureReasons.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Failure reasons">
          {summary.failureReasons.map((f) => (
            <Badge key={f.code} variant="outline" className="tabular-nums">
              {FAILURE_LABELS[f.code] ?? f.code.replace(/_/g, ' ')}: {f.count}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
