import { Link } from 'react-router-dom';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Building2, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { parkingFlowFadeUp, parkingFlowTransition } from '@/lib/parking/parkingFlowMotion';
import { cn } from '@/lib/utils';

type SuccessTone = 'waiting' | 'complete';

interface FormSuccessProps {
  /** Body copy under the heading. */
  message: string;
  formName: string;
  /** Heading — must match reality (e.g. "Request submitted", not "All done" mid-flow). */
  title?: string;
  /** waiting = amber / in-progress; complete = emerald / finished. */
  tone?: SuccessTone;
  submissionId?: string;
  propertyId?: string;
  propertyName?: string;
  /** When set, primary CTA tracks the request (e.g. parking status page). */
  statusUrl?: string;
  statusLabel?: string;
}

const TONE_STYLES: Record<SuccessTone, { wrap: string; icon: string; Icon: typeof Clock }> = {
  waiting: {
    wrap: 'bg-amber-50 dark:bg-amber-950/50',
    icon: 'text-amber-700 dark:text-amber-300',
    Icon: Loader2,
  },
  complete: {
    wrap: 'bg-emerald-50 dark:bg-emerald-950/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
};

export function FormSuccess({
  message,
  formName: _formName,
  title = 'Request submitted',
  tone = 'waiting',
  submissionId,
  propertyId,
  propertyName,
  statusUrl,
  statusLabel = 'Track request',
}: FormSuccessProps) {
  const reduceMotion = useReducedMotion();
  const styles = TONE_STYLES[tone];
  const StatusIcon = styles.Icon;
  const transition = parkingFlowTransition(reduceMotion);

  return (
    <motion.div
      initial={reduceMotion ? false : parkingFlowFadeUp.initial}
      animate={parkingFlowFadeUp.animate}
      transition={transition}
      className="text-center"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl',
          styles.wrap
        )}
      >
        <StatusIcon
          className={cn(
            'h-8 w-8',
            styles.icon,
            tone === 'waiting' && 'animate-spin motion-reduce:animate-none'
          )}
          aria-hidden
        />
      </div>

      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>

      <p className="text-muted-foreground mx-auto mt-3 max-w-sm text-sm leading-relaxed sm:text-base">
        {message}
      </p>

      {submissionId ? (
        <div className="border-border bg-muted/30 mt-6 inline-flex max-w-full items-center gap-2.5 rounded-xl border px-4 py-3">
          <FileText className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground shrink-0 text-xs sm:text-sm">Reference</span>
          <span className="text-foreground min-w-0 truncate font-mono text-xs font-semibold sm:text-sm">
            {submissionId}
          </span>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center">
        {statusUrl ? (
          <Button asChild className="min-h-[44px] w-full gap-2 sm:w-auto" size="lg">
            <Link to={statusUrl}>
              <Clock className="h-4 w-4" aria-hidden />
              {statusLabel}
            </Link>
          </Button>
        ) : propertyId ? (
          <Button asChild className="min-h-[44px] w-full gap-2 sm:w-auto" size="lg">
            <Link to={`/properties/${propertyId}`}>
              <Building2 className="h-4 w-4" aria-hidden />
              {propertyName ?? 'View property'}
            </Link>
          </Button>
        ) : null}

        <Button
          asChild
          variant={propertyId || statusUrl ? 'outline' : 'default'}
          className="min-h-[44px] w-full gap-2 sm:w-auto"
          size="lg"
        >
          <Link to="/">
            Home
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
