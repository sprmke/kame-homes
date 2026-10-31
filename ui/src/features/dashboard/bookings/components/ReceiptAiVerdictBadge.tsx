import { useEffect, useRef, useState } from 'react';

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  HelpCircle,
  Loader2,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  semanticBadgeClasses,
  semanticSurfaceClasses,
  softSurfaceClasses,
  type SemanticBadgeVariant,
} from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

/** Dedupes AI service failure toasts (backfill + upload). */
const DOCUMENT_AI_ERROR_TOAST_ID = 'document-ai-error';

/** User-facing copy for raw Gemini / network errors. */
function simplifyAiModelErrorMessage(raw: string): string {
  const msg = raw.trim();
  if (!msg) return 'Try again in a minute.';

  const lower = msg.toLowerCase();
  if (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate-limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded')
  ) {
    const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)/i);
    if (retryMatch) {
      const secs = Math.ceil(Number(retryMatch[1]));
      if (Number.isFinite(secs) && secs > 0 && secs <= 120) {
        return `Service limit reached. Try again in about ${secs} seconds.`;
      }
    }
    return 'Service limit reached. Try again in a minute.';
  }
  if (lower.includes('high demand') || lower.includes('overloaded')) {
    return 'Service is busy. Try again later.';
  }
  if (
    lower.includes('api key') ||
    lower.includes('unauthorized') ||
    lower.includes('permission denied')
  ) {
    return 'AI is not configured. Check Settings.';
  }
  return 'Try again in a minute.';
}

export function showDocumentAiModelErrorToast(rawError?: string | null): void {
  toast.error('Receipt check unavailable', {
    id: DOCUMENT_AI_ERROR_TOAST_ID,
    description: simplifyAiModelErrorMessage(rawError?.trim() ?? ''),
    duration: 8000,
  });
}

export type ReceiptAiVerdict =
  'valid' | 'likely_valid' | 'unclear' | 'invalid' | 'skipped' | string | null | undefined;

export function formatReceiptAiVerdictLabel(verdict: ReceiptAiVerdict): string {
  switch (String(verdict ?? '').toLowerCase()) {
    case 'valid':
      return 'Valid';
    case 'likely_valid':
      return 'Likely valid';
    case 'unclear':
      return 'Unclear';
    case 'invalid':
      return 'Invalid';
    case 'skipped':
      return 'Not checked';
    default:
      return verdict ? String(verdict) : 'Unknown';
  }
}

/** Soft tone for the verdict mark — teal passed, rose failed, amber needs a look. */
export function receiptAiVerdictTone(verdict: ReceiptAiVerdict): SemanticBadgeVariant {
  const v = String(verdict ?? '').toLowerCase();
  if (v === 'valid' || v === 'likely_valid') return 'success';
  if (v === 'invalid') return 'danger';
  return 'pending';
}

/** Check passed, cross failed, triangle inconclusive — so the shape reads without color. */
export function receiptAiVerdictGlyph(verdict: ReceiptAiVerdict): LucideIcon {
  const tone = receiptAiVerdictTone(verdict);
  if (tone === 'success') return Check;
  if (tone === 'danger') return X;
  return AlertTriangle;
}

type VerdictMarkSize = 'sm' | 'md';

/**
 * Icon-only verdict mark for dense rows and thumbnails. Shape carries pass /
 * fail / inconclusive and color reinforces it; the full "AI: …" wording stays
 * on `aria-label` / `title` so neither is the only signal.
 */
export function ReceiptAiVerdictMark({
  verdict,
  className,
  size = 'md',
}: {
  verdict: ReceiptAiVerdict;
  className?: string;
  size?: VerdictMarkSize;
}) {
  if (!verdict || String(verdict).toLowerCase() === 'skipped') return null;

  const label = `AI: ${formatReceiptAiVerdictLabel(verdict)}`;
  const Glyph = receiptAiVerdictGlyph(verdict);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border',
        size === 'sm' ? 'size-5' : 'size-6',
        semanticBadgeClasses(receiptAiVerdictTone(verdict)),
        className
      )}
    >
      <Glyph className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.75} aria-hidden />
    </span>
  );
}

export function receiptAiVerdictBlocksAdmin(verdict: ReceiptAiVerdict): boolean {
  return String(verdict ?? '').toLowerCase() === 'invalid';
}

/** Summary line color in dense status-report rows (e.g. Document checks list). */
export function receiptAiVerdictReportTextClass(
  verdict: ReceiptAiVerdict,
  loading = false
): string {
  if (loading) return 'text-muted-foreground';
  const v = String(verdict ?? '').toLowerCase();
  if (!v || v === 'skipped') return 'text-muted-foreground';
  return semanticSurfaceClasses(receiptAiVerdictTone(verdict)).color;
}

/**
 * Full-bleed verdict strip for preview surfaces. Sits under a preview header and
 * states, in this order, that a check ran, what it concluded, and why — so the
 * host reads the verdict against the document without hunting for a chip.
 *
 * The tinted band and the check / cross glyph are the verdict; both are
 * restated in text because neither color nor shape can carry a result alone.
 */
export function ReceiptAiVerdictBanner({
  verdict,
  summary,
  loading = false,
  className,
}: {
  verdict: ReceiptAiVerdict;
  summary?: string | null;
  /** A check is in flight — no verdict yet, but the host should know one is coming. */
  loading?: boolean;
  className?: string;
}) {
  const detail = summary?.trim();
  const detailRef = useRef<HTMLParagraphElement | null>(null);
  /** A capped summary that overflows is a scroll region, so it needs a tab stop. */
  const [detailScrolls, setDetailScrolls] = useState(false);

  useEffect(() => {
    const el = detailRef.current;
    if (!el) {
      setDetailScrolls(false);
      return;
    }
    const measure = () => setDetailScrolls(el.scrollHeight - el.clientHeight > 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [detail]);

  const settled = Boolean(verdict) && String(verdict).toLowerCase() !== 'skipped';
  if (!loading && !settled) return null;

  const surface = semanticSurfaceClasses(loading ? 'neutral' : receiptAiVerdictTone(verdict));
  const BannerGlyph = receiptAiVerdictGlyph(verdict);

  return (
    <div
      role="status"
      className={cn(
        'flex shrink-0 items-start gap-2.5 border-b px-2.5 py-2 sm:px-4 sm:py-2.5',
        surface.borderColor,
        surface.bgColor,
        className
      )}
    >
      {loading ? (
        <Loader2 className={cn('mt-0.5 size-4 shrink-0 animate-spin', surface.color)} aria-hidden />
      ) : (
        <BannerGlyph
          className={cn('mt-0.5 size-4 shrink-0', surface.color)}
          strokeWidth={2.75}
          aria-hidden
        />
      )}
      <div className={cn('min-w-0 flex-1 space-y-0.5', surface.color)}>
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs font-semibold leading-snug sm:text-sm">
          {loading ? 'Checking document' : formatReceiptAiVerdictLabel(verdict)}
          <span className="text-[11px] font-medium opacity-70">AI document check</span>
        </p>
        {!loading && detail ? (
          <p
            ref={detailRef}
            tabIndex={detailScrolls ? 0 : undefined}
            className="focus-ring max-h-20 overflow-y-auto overscroll-contain rounded-sm text-xs leading-relaxed [overflow-wrap:anywhere]"
          >
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

type NoticeCopy = {
  title: string;
  detail?: string;
};

export type DocumentAiVerdictVariant = 'receipt' | 'valid_id';

function noticeCopy(
  verdict: ReceiptAiVerdict,
  summary?: string | null,
  variant: DocumentAiVerdictVariant = 'receipt'
): NoticeCopy | null {
  const v = String(verdict ?? '').toLowerCase();
  if (variant === 'valid_id') {
    switch (v) {
      case 'valid':
        return {
          title: 'Looks like a government ID',
          detail: summary?.trim() || undefined,
        };
      case 'likely_valid':
        return {
          title: 'Probably a valid ID',
          detail: summary?.trim() || 'Some details were hard to read. Review if unsure.',
        };
      case 'unclear':
        return {
          title: "Couldn't verify this ID",
          detail: 'Review it yourself or upload a clearer photo or PDF.',
        };
      case 'invalid':
        return {
          title: "Doesn't look like a valid ID",
          detail: 'Upload a clear photo or scan of a government-issued photo ID.',
        };
      case 'skipped':
        return null;
      default:
        return null;
    }
  }
  switch (v) {
    case 'valid':
      return {
        title: 'Looks like payment proof',
        detail: summary?.trim() || undefined,
      };
    case 'likely_valid':
      return {
        title: 'Probably payment proof',
        detail: summary?.trim() || 'Some details were hard to read. Review if unsure.',
      };
    case 'unclear':
      return {
        title: "Couldn't verify this image",
        detail: 'Review it yourself or upload a clearer screenshot or cash photo.',
      };
    case 'invalid':
      return {
        title: "Doesn't look like payment proof",
        detail: 'Upload a GCash/Maya/bank transfer screenshot or a clear photo of the cash paid.',
      };
    case 'skipped':
      return null;
    default:
      return null;
  }
}

function cardClass(verdict: ReceiptAiVerdict): string {
  const v = String(verdict ?? '').toLowerCase();
  if (v === 'valid' || v === 'likely_valid') return softSurfaceClasses('success');
  if (v === 'invalid') return softSurfaceClasses('danger');
  return softSurfaceClasses('pending');
}

function NoticeIcon({ verdict }: { verdict: ReceiptAiVerdict }) {
  const v = String(verdict ?? '').toLowerCase();
  const className = 'size-4 shrink-0 mt-0.5';
  if (v === 'valid' || v === 'likely_valid') {
    return (
      <CheckCircle2
        className={cn(className, 'text-emerald-600 dark:text-emerald-400')}
        aria-hidden
      />
    );
  }
  if (v === 'invalid') {
    return <XCircle className={cn(className, 'text-red-600 dark:text-red-400')} aria-hidden />;
  }
  if (v === 'unclear') {
    return (
      <HelpCircle className={cn(className, 'text-amber-600 dark:text-amber-400')} aria-hidden />
    );
  }
  return (
    <AlertTriangle className={cn(className, 'text-amber-600 dark:text-amber-400')} aria-hidden />
  );
}

type Props = {
  verdict: ReceiptAiVerdict;
  summary?: string | null;
  className?: string;
  /** Pricing card: small pill only */
  compact?: boolean;
  variant?: DocumentAiVerdictVariant;
};

export function ReceiptAiVerdictBadge({
  verdict,
  summary,
  className,
  compact = false,
  variant = 'receipt',
}: Props) {
  if (!verdict || String(verdict).toLowerCase() === 'skipped') return null;

  const copy = noticeCopy(verdict, summary, variant);
  if (!copy) return null;

  if (compact) {
    return <ReceiptAiVerdictMark verdict={verdict} className={className} />;
  }

  return (
    <div
      className={cn('flex gap-2 rounded-lg border px-3 py-2.5', cardClass(verdict), className)}
      role="status"
    >
      <NoticeIcon verdict={verdict} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-foreground text-xs font-medium leading-snug">{copy.title}</p>
        {copy.detail ? (
          <p className="text-muted-foreground text-[11px] leading-snug">{copy.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Short toast after upload — keeps forms consistent. */
export function receiptAiUploadToastMessage(
  verdict: string | null | undefined,
  variant: DocumentAiVerdictVariant = 'receipt'
): { type: 'success' | 'warning' | 'error'; message: string; description?: string } | null {
  if (variant === 'valid_id') {
    switch (String(verdict ?? '').toLowerCase()) {
      case 'invalid':
        return {
          type: 'error',
          message: "That image doesn't look like a valid ID",
        };
      case 'unclear':
        return {
          type: 'warning',
          message: "Couldn't verify the ID. Please review",
        };
      case 'valid':
      case 'likely_valid':
        return { type: 'success', message: 'Valid ID uploaded' };
      default:
        return null;
    }
  }
  switch (String(verdict ?? '').toLowerCase()) {
    case 'invalid':
      return {
        type: 'error',
        message: "That image doesn't look like payment proof",
      };
    case 'unclear':
      return {
        type: 'warning',
        message: "Couldn't verify the receipt. Please review",
      };
    case 'valid':
    case 'likely_valid':
      return { type: 'success', message: 'Receipt uploaded' };
    default:
      return null;
  }
}
