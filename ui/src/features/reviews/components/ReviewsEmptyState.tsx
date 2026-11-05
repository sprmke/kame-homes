import type { ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  /** One short line only when the state needs explaining (e.g. the review window). */
  description?: string;
  action?: ReactNode;
};

/** List empty state for the Reviews tabs — matches the org property / parking lists. */
export function ReviewsEmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div
      role="status"
      className="surface-card flex flex-col items-center justify-center gap-3 px-4 py-10 text-center sm:py-16"
    >
      <div className="icon-well-sm inline-flex items-center justify-center">
        <Icon className="text-muted-foreground size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        {description ? <p className="text-caption max-w-xs">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
