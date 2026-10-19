import { Link } from 'react-router-dom';

type Props = {
  /** Guest page name shown in the title (e.g. Showcase, Stay Guide). */
  pageLabel: string;
};

/**
 * Non-dismissible full-viewport lock when a Public Pages guest URL is opened
 * without the property’s plan entitlement. No close control — leave via Home.
 */
export function PublicPagePlanAccessOverlay({ pageLabel }: Props) {
  const titleId = 'public-page-plan-lock-title';
  const descId = 'public-page-plan-lock-desc';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="border-border bg-card text-card-foreground w-full max-w-md rounded-2xl border p-6 shadow-xl sm:p-8">
        <h1 id={titleId} className="text-lg font-semibold tracking-tight sm:text-xl">
          {pageLabel} isn’t available
        </h1>
        <p id={descId} className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Your host’s plan doesn’t include this page. Contact them if you need access.
        </p>
        <Link
          to="/"
          className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
