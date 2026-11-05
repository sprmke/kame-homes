import { useEffect, useMemo, useState } from 'react';

import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { handleAiMutationError } from '@/features/dashboard/org/lib/aiQuotaToast';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import {
  useReviewAutomationRules,
  useSaveReviewAutomationRules,
} from '@/features/reviews/hooks/useReviewAutomation';
import {
  DEFAULT_REVIEW_AUTOMATION_RULES,
  type ReviewAutomationRules,
} from '@/features/reviews/lib/reviewAutomationApi';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

const MIN_TEMPLATES = 3;
const MIN_DELAY = 1;
const MAX_DELAY = 13;

function rulesEqual(a: ReviewAutomationRules, b: ReviewAutomationRules): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ReviewAutomationCard({ canEdit }: { canEdit: boolean }) {
  const query = useReviewAutomationRules();
  const save = useSaveReviewAutomationRules();
  const { canUse } = useFeatureGate('reviewAutomation');
  const { open: openUpgradeModal } = useUpgradeModal();
  const baseline = query.data ?? DEFAULT_REVIEW_AUTOMATION_RULES;
  const [form, setForm] = useState<ReviewAutomationRules>(baseline);

  useEffect(() => {
    setForm(baseline);
  }, [baseline]);

  const isDirty = useMemo(() => !rulesEqual(form, baseline), [form, baseline]);

  const handleSave = async (): Promise<boolean> => {
    if (!canEdit) return false;
    if (!canUse) {
      openUpgradeModal('reviewAutomation');
      return false;
    }
    if (form.enabled && form.templates.filter((t) => t.trim()).length < MIN_TEMPLATES) {
      toast.error(`Add at least ${MIN_TEMPLATES} templates`);
      return false;
    }
    try {
      const saved = await save.mutateAsync(form);
      setForm(saved);
      toast.success('Auto-review saved');
      return true;
    } catch (err) {
      if (err instanceof Error) handleAiMutationError(err);
      else toast.error('Could not save auto-review');
      return false;
    }
  };

  useUnsavedChangesGuard({
    isDirty: canEdit && isDirty,
    onSave: handleSave,
    onDiscard: () => setForm(baseline),
    enabled: canEdit,
  });

  const setEnabled = (enabled: boolean) => {
    if (!canUse) {
      openUpgradeModal('reviewAutomation');
      return;
    }
    setForm((prev) => ({ ...prev, enabled }));
  };

  return (
    <section className="border-border bg-card space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-base font-medium">Auto-review</h2>
          <TierBadge feature="reviewAutomation" />
        </div>
        <Switch
          checked={form.enabled}
          disabled={!canEdit}
          aria-label="Auto-review guests"
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="auto-review-delay">Days after checkout</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            className="size-11 shrink-0 p-0"
            disabled={!canEdit || form.delayDays <= MIN_DELAY}
            aria-label="Fewer days"
            onClick={() =>
              setForm((prev) => ({ ...prev, delayDays: Math.max(MIN_DELAY, prev.delayDays - 1) }))
            }
          >
            <Minus className="size-4" />
          </Button>
          <span id="auto-review-delay" className="min-w-8 text-center text-sm font-medium">
            {form.delayDays}
          </span>
          <Button
            type="button"
            variant="outline"
            className="size-11 shrink-0 p-0"
            disabled={!canEdit || form.delayDays >= MAX_DELAY}
            aria-label="More days"
            onClick={() =>
              setForm((prev) => ({ ...prev, delayDays: Math.min(MAX_DELAY, prev.delayDays + 1) }))
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Templates</Label>
        {form.templates.map((template, index) => (
          <div key={index} className="flex gap-2">
            <Textarea
              value={template}
              disabled={!canEdit}
              aria-label={`Template ${index + 1}`}
              onChange={(event) =>
                setForm((prev) => {
                  const templates = [...prev.templates];
                  templates[index] = event.target.value;
                  return { ...prev, templates };
                })
              }
            />
            {form.templates.length > MIN_TEMPLATES ? (
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 p-0"
                disabled={!canEdit}
                aria-label={`Remove template ${index + 1}`}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    templates: prev.templates.filter((_, i) => i !== index),
                  }))
                }
              >
                <Minus className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          disabled={!canEdit}
          onClick={() => setForm((prev) => ({ ...prev, templates: [...prev.templates, ''] }))}
        >
          Add template
        </Button>
      </div>

      <div className="space-y-1">
        {(
          [
            ['skipOnIssueTags', 'Skip if the guest left issue tags'],
            ['skipOnOpenMaintenance', 'Skip if maintenance is open'],
            ['skipOnSdDeduction', 'Skip if the deposit was reduced'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-h-[44px] items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={form[key]}
              disabled={!canEdit}
              onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>

      {canEdit ? (
        <Button
          type="button"
          className="min-h-[44px] w-full sm:w-auto"
          disabled={!isDirty || save.isPending}
          onClick={() => void handleSave()}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      ) : null}
    </section>
  );
}
