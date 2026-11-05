import { useMemo, useState } from 'react';

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
import { Button } from '@/components/ui/button';
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

export function DataTableBlock({
  title,
  columns,
  rows,
  rowTargets,
  sortable,
  pageSize,
  phoneColumns,
  downloadable,
}: Props) {
  const safeColumns = columns ?? [];
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const size = pageSize ?? 8;
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
  const anyLinked = visibleRows.some(({ href }) => href);
  const sortedRows = useMemo(() => {
    if (!sort) return visibleRows;
    const copy = [...visibleRows];
    copy.sort((a, b) => {
      const left = dataTableCell(a.row, sort.col, safeColumns);
      const right = dataTableCell(b.row, sort.col, safeColumns);
      return sort.dir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
    return copy;
  }, [visibleRows, sort, safeColumns]);
  if (
    !dataTableHasRows(
      safeColumns,
      visibleRows.map(({ row }) => row)
    )
  )
    return null;
  const pageRows = showAll ? sortedRows : sortedRows.slice(0, size);
  const extra = sortedRows.length - pageRows.length;
  const hideOnPhone = (col: string) =>
    Boolean(
      phoneColumns?.length && !phoneColumns.some((name) => name.toLowerCase() === col.toLowerCase())
    );

  const copyCsv = () => {
    const header = safeColumns.join(',');
    const body = sortedRows
      .map(({ row }) =>
        safeColumns
          .map((col) => `"${dataTableCell(row, col, safeColumns).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    void navigator.clipboard.writeText(`${header}\n${body}`);
  };

  return (
    <div className="border-border/60 bg-card space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {title && <p className="text-foreground min-w-0 flex-1 text-sm font-semibold">{title}</p>}
        {downloadable !== false ? (
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={copyCsv}>
            Copy as CSV
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {safeColumns.map((col) => (
                <TableHead
                  key={col}
                  className={cn('text-xs', hideOnPhone(col) && 'hidden lg:table-cell')}
                >
                  {sortable !== false ? (
                    <button
                      type="button"
                      className="min-h-11 text-left"
                      onClick={() =>
                        setSort((prev) =>
                          prev?.col === col
                            ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                            : { col, dir: 'asc' }
                        )
                      }
                    >
                      {col}
                    </button>
                  ) : (
                    col
                  )}
                </TableHead>
              ))}
              {anyLinked && <TableHead className="w-6 px-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map(({ row, href }, i) => (
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
                    <TableCell
                      key={col}
                      className={cn('text-xs', hideOnPhone(col) && 'hidden lg:table-cell')}
                    >
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
      {extra > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={() => setShowAll(true)}
        >
          Show {extra} more
        </Button>
      ) : null}
    </div>
  );
}
