import { useState } from 'react';

import { Save } from 'lucide-react';

import { useMarketingPermissions } from '@/features/dashboard/marketing/hooks/useMarketingPermissions';
import {
  useSaveMarketingTemplate,
  useUpdateMarketingTemplate,
  type MarketingTemplateRecord,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  contentType: 'calendar' | 'design' | 'video';
  designJson: Record<string, unknown>;
  defaultName?: string;
  platform?: string;
  aspectPreset?: string;
  /** Theme the saved item belongs to. */
  themeKey?: string | null;
  /** When set, Save updates the existing row instead of creating a new one */
  existingTemplateId?: string | null;
  buttonLabel?: string;
  updateLabel?: string;
  onSaved?: (record: MarketingTemplateRecord) => void;
};

export function SaveMarketingTemplateButton({
  contentType,
  designJson,
  defaultName = 'My template',
  platform,
  aspectPreset,
  themeKey,
  existingTemplateId,
  buttonLabel = 'Save',
  updateLabel = 'Update',
  onSaved,
}: Props) {
  const save = useSaveMarketingTemplate();
  const update = useUpdateMarketingTemplate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const { canAddTemplate, canEditTemplate } = useMarketingPermissions();
  const { canUse: canUseCustomTemplates, isLoading: customTemplatesLoading } =
    useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  if (!canAddTemplate && !(existingTemplateId && canEditTemplate)) {
    return null;
  }

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (existingTemplateId) {
      const record = await update.mutateAsync({
        id: existingTemplateId,
        name: trimmed,
        aspectPreset,
        platform,
        designJson,
        ...(themeKey !== undefined ? { themeKey } : {}),
      });
      onSaved?.(record);
    } else {
      const record = await save.mutateAsync({
        name: trimmed,
        contentType,
        platform,
        aspectPreset,
        designJson,
        themeKey: themeKey ?? null,
      });
      onSaved?.(record);
    }
    setOpen(false);
  };

  const isPending = save.isPending || update.isPending;

  return (
    <>
      <TierBadgeAnchor feature="customTemplates">
        <Button
          type="button"
          className="min-h-[44px] gap-2"
          onClick={() => {
            if (!canUseCustomTemplates) {
              if (!customTemplatesLoading) openUpgradeModal('customTemplates');
              return;
            }
            if (existingTemplateId) {
              void update
                .mutateAsync({
                  id: existingTemplateId,
                  name: defaultName.trim() || 'Template',
                  aspectPreset,
                  platform,
                  designJson,
                  ...(themeKey !== undefined ? { themeKey } : {}),
                })
                .then((record) => onSaved?.(record));
              return;
            }
            setName(defaultName);
            setOpen(true);
          }}
          disabled={isPending}
        >
          <Save className="size-4" aria-hidden />
          {existingTemplateId ? updateLabel : buttonLabel}
        </Button>
      </TierBadgeAnchor>

      <AdminDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Save template"
        sizeClassName="max-w-[min(calc(100vw-1.5rem),24rem)] sm:max-w-[min(90vw,24rem)]"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isPending} onClick={() => void handleSave()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <Label htmlFor="template-name">Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10"
          />
        </div>
      </AdminDialogShell>
    </>
  );
}
