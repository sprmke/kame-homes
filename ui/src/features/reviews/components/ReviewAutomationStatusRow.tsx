import { Sparkles } from 'lucide-react';

import { useReviewAutomationRules } from '@/features/reviews/hooks/useReviewAutomation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * One-line auto-review state above the To write queue — the list auto-review
 * drains. Settings themselves live in `ReviewAutomationSheet`.
 */
export function ReviewAutomationStatusRow({ onManage }: { onManage: () => void }) {
  const { data, isLoading } = useReviewAutomationRules();
  if (isLoading || !data) return null;

  return (
    <div className="surface-muted flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Sparkles className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <p className="text-foreground shrink-0 text-[13px] font-medium">Auto-review</p>
        <Badge variant={data.enabled ? 'success' : 'outline'} className="truncate font-medium">
          {data.enabled ? `${data.delayDays}d after checkout` : 'Off'}
        </Badge>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="settings-action"
        onClick={onManage}
      >
        Manage
      </Button>
    </div>
  );
}
