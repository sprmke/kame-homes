import { useState, type ComponentType } from 'react';

import { FileText, Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  fetchAllFinanceBookings,
  fetchFinanceLineItems,
  fetchFinanceSummary,
} from '@/features/dashboard/finance/hooks/useFinanceApi';
import type {
  FinanceExportType,
  FinanceLineItem,
  FinanceQuery,
  FinanceSummary,
} from '@/features/dashboard/finance/lib/types';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { friendlyToastError } from '@/lib/feedback/toastMessages';
import { pdfParkingScope, pdfPropertyScope } from '@/lib/pdf/pdfScopeLabel';
import { usePdfBrandColor } from '@/lib/pdf/usePdfBrandColor';
import { cn } from '@/lib/utils';

const FULL_REPORT = { type: 'combined' as const, label: 'Full report' };

const SECTION_OPTIONS: { type: FinanceExportType; label: string }[] = [
  { type: 'overview', label: 'Overview summary' },
  { type: 'stays', label: 'Stays ledger' },
  { type: 'operating', label: 'Transactions' },
];

const outlineBtnClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] font-semibold text-foreground transition-all duration-100 hover:border-primary/40 hover:bg-muted/60 disabled:opacity-60 max-sm:rounded-2xl max-sm:px-3 max-sm:shadow-native-float';

export type FinanceExportLeadingAction = {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
};

type Props = {
  query: FinanceQuery;
  summary?: FinanceSummary;
  operating?: FinanceLineItem[];
  /**
   * `hero` — single top-right brand-hero control (Add + PDF options in one menu).
   * `default` — outline “Export report” control for desktop headers / toolbars.
   */
  variant?: 'default' | 'hero';
  /** Shown above export options when `variant="hero"` (e.g. Add transaction). */
  leadingActions?: FinanceExportLeadingAction[];
};

export function FinanceExportMenu({
  query,
  summary: cachedSummary,
  operating: cachedOperating,
  variant = 'default',
  leadingActions = [],
}: Props) {
  const scope = useAdminAssetScope();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const brandColor = usePdfBrandColor();
  const pdfScope = parkingContext?.parking
    ? pdfParkingScope(parkingContext.parking)
    : orgContext?.property
      ? pdfPropertyScope(orgContext.property)
      : null;
  const isParkingScope = Boolean(scope.parkingId);
  const { data: propertyAccess } = usePropertyPermissions();
  const canSeeExport =
    isParkingScope || hasPropertyPermission(propertyAccess?.permissions, 'finance.export:view');
  const sectionOptions = isParkingScope
    ? SECTION_OPTIONS.filter((opt) => opt.type !== 'stays')
    : SECTION_OPTIONS;
  const [loading, setLoading] = useState<FinanceExportType | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { canUse: canExport, isLoading: entitlementsLoading } = useFeatureGate('financeReporting');
  const { open: openUpgradeModal } = useUpgradeModal();

  async function handlePdfExport(type: FinanceExportType) {
    if (!canExport) {
      if (!entitlementsLoading) openUpgradeModal('financeReporting');
      return;
    }
    setLoading(type);
    try {
      const needsStays = !isParkingScope && (type === 'stays' || type === 'combined');
      const needsOperating = type === 'operating' || type === 'combined';

      const [{ downloadFinanceReportPdf }, summary, stays, operating] = await Promise.all([
        import('@/features/dashboard/finance/lib/exportPdf'),
        cachedSummary ?? fetchFinanceSummary(query, scope),
        needsStays ? fetchAllFinanceBookings(query, scope) : Promise.resolve([]),
        needsOperating
          ? (cachedOperating ?? fetchFinanceLineItems(query, undefined, scope))
          : Promise.resolve([]),
      ]);

      await downloadFinanceReportPdf(
        {
          query,
          summary,
          stays,
          operating,
          scopeLabel: pdfScope?.label,
          brandColor,
        },
        type
      );
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(friendlyToastError(e, 'PDF export failed'));
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;
  const exportItems = [FULL_REPORT, ...sectionOptions];

  if (!canSeeExport && leadingActions.length === 0) {
    return null;
  }

  if (variant === 'hero') {
    const hasLeading = leadingActions.length > 0;
    const TriggerIcon = busy ? Loader2 : hasLeading ? MoreHorizontal : FileText;
    const sheetTitle = hasLeading ? 'Finance actions' : 'Export report';

    return (
      <>
        <MobileHeroActionButton
          aria-label={sheetTitle}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          disabled={busy}
          onClick={() => setSheetOpen(true)}
        >
          <TriggerIcon className={cn('size-5', busy && 'animate-spin')} aria-hidden />
        </MobileHeroActionButton>
        <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title={sheetTitle}>
          <div role="listbox" aria-label={sheetTitle}>
            {leadingActions.map((action) => {
              const Icon = action.Icon;
              return (
                <MobileChoiceItem
                  key={action.key}
                  label={action.label}
                  disabled={busy}
                  icon={<Icon className="size-5" aria-hidden />}
                  onSelect={() => {
                    action.onSelect();
                    setSheetOpen(false);
                  }}
                />
              );
            })}
            {hasLeading && canSeeExport ? (
              <div className="border-border/60 my-1.5 border-t" aria-hidden />
            ) : null}
            {canSeeExport
              ? exportItems.map((opt) => (
                  <MobileChoiceItem
                    key={opt.type}
                    label={loading === opt.type ? 'Preparing…' : opt.label}
                    disabled={busy}
                    icon={<FileText className="size-5" aria-hidden />}
                    onSelect={() => {
                      void handlePdfExport(opt.type);
                      setSheetOpen(false);
                    }}
                  />
                ))
              : null}
          </div>
        </MobileChoiceSheet>
      </>
    );
  }

  if (!canSeeExport) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={cn(outlineBtnClass, 'relative gap-1.5 px-3')}
          aria-label="Export report"
        >
          {busy ? (
            <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FileText className="text-muted-foreground size-4 shrink-0" aria-hidden />
          )}
          <span className="hidden sm:inline">Export report</span>
          <span className="sm:hidden">Report</span>
          <TierBadge
            feature="financeReporting"
            placement="corner"
            className="hidden sm:inline-flex"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {exportItems.map((opt) => (
          <DropdownMenuItem
            key={opt.type}
            disabled={busy}
            onSelect={() => void handlePdfExport(opt.type)}
            className="min-h-[44px] gap-2"
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            {loading === opt.type ? 'Preparing…' : opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Convenience leading action for Add transaction on finance hero menus. */
export function financeAddTransactionAction(onSelect: () => void): FinanceExportLeadingAction {
  return { key: 'add', label: 'Add transaction', Icon: Plus, onSelect };
}
