import { ChevronRight } from 'lucide-react';

import type { ChatBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import { bookingDetailHref } from '@/features/dashboard/ai-assistant/lib/assistantEntityLinks';
import { useAssistantNavigate } from '@/features/dashboard/ai-assistant/lib/assistantSurfaceContext';
import {
  dataTableCell,
  dataTableHasRows,
  dataTableRowCells,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { useProperties } from '@/features/dashboard/org/hooks/useOrganizations';
import { useParkings } from '@/features/dashboard/org/hooks/useParkings';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';

import { InlineRichText } from '@/components/chat/ChatRichBody';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { stripInlineMarkdown } from '@/lib/chat/inlineMarkdown';
import { cn } from '@/lib/utils';

type Props = Extract<ChatBlock, { type: 'data_table' }>;

function isStatusColumn(col: string): boolean {
  return /^status$/i.test(col.trim());
}

export function DataTableBlock({ title, columns, rows, rowTargets }: Props) {
  const safeColumns = columns ?? [];
  const orgSlug = useOrgSlugParam() ?? undefined;
  const targets = rowTargets ?? [];
  const { data: propertiesData } = useProperties(
    targets.some((t) => t?.propertyId) ? orgSlug : undefined
  );
  const { data: parkingsData } = useParkings(
    targets.some((t) => t?.parkingId) ? orgSlug : undefined
  );
  const navigateTo = useAssistantNavigate();

  const visibleRows = (rows ?? [])
    .map((row, i) => {
      const target = targets[i];
      const href = target
        ? bookingDetailHref({
            orgSlug: orgSlug ?? null,
            bookingId: target.bookingId,
            propertyId: target.propertyId,
            parkingId: target.parkingId,
            properties: propertiesData?.properties,
            parkings: parkingsData?.parkings,
          })
        : null;
      return { row, href };
    })
    .filter(({ row }) => dataTableRowCells(row, safeColumns).some((cell) => cell.trim() !== ''));
  if (
    !dataTableHasRows(
      safeColumns,
      visibleRows.map(({ row }) => row)
    )
  )
    return null;
  const anyLinked = visibleRows.some(({ href }) => href);

  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      {title && <p className="text-foreground text-sm font-semibold">{title}</p>}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {safeColumns.map((col) => (
                <TableHead key={col} className="text-xs">
                  {col}
                </TableHead>
              ))}
              {anyLinked && <TableHead className="w-6 px-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map(({ row, href }, i) => (
              <TableRow
                key={i}
                onClick={href ? () => navigateTo(href) : undefined}
                className={cn(href && 'hover:bg-muted/40 group cursor-pointer')}
              >
                {safeColumns.map((col, colIndex) => {
                  const raw = dataTableCell(row, col, safeColumns);
                  const value = stripInlineMarkdown(raw);
                  const content =
                    isStatusColumn(col) && value.trim() ? (
                      <StatusBadge status={value} className="max-w-[11rem]" />
                    ) : (
                      <InlineRichText text={raw} />
                    );
                  return (
                    <TableCell key={col} className="text-xs">
                      {href && colIndex === 0 ? (
                        <button
                          type="button"
                          aria-label={`Open ${value || 'booking'}`}
                          className="focus-visible:ring-ring rounded text-left focus-visible:outline-none focus-visible:ring-2"
                        >
                          {content}
                        </button>
                      ) : (
                        content
                      )}
                    </TableCell>
                  );
                })}
                {anyLinked && (
                  <TableCell className="w-6 px-0">
                    {href && (
                      <ChevronRight
                        className="text-muted-foreground group-hover:text-foreground size-4"
                        aria-hidden
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
