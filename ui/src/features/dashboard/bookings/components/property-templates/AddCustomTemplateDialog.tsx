import * as React from 'react';

import { Plus } from 'lucide-react';

import { RichTextEditor } from '@/features/dashboard/bookings/components/property-templates/RichTextEditor';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useGuardedClose } from '@/hooks/useGuardedClose';

type Props = {
  onAdd: (name: string, content: string) => Promise<void>;
  busy?: boolean;
  /** Optional custom trigger (e.g. mobile hero icon button). */
  trigger?: React.ReactNode;
};

export function AddCustomTemplateDialog({ onAdd, busy, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [content, setContent] = React.useState('');
  const { canUse: canUseCustomTemplates, isLoading: customTemplatesLoading } =
    useFeatureGate('customTemplates');
  const { open: openUpgradeModal } = useUpgradeModal();

  const openCreateOrUpgrade = React.useCallback(() => {
    if (!canUseCustomTemplates) {
      if (!customTemplatesLoading) openUpgradeModal('customTemplates');
      return;
    }
    setOpen(true);
  }, [canUseCustomTemplates, customTemplatesLoading, openUpgradeModal]);

  const resetDraft = React.useCallback(() => {
    setName('');
    setContent('');
  }, []);

  const handleAdd = async (): Promise<boolean> => {
    if (!name.trim()) return false;
    try {
      await onAdd(name.trim(), content);
    } catch {
      return false;
    }
    resetDraft();
    setOpen(false);
    return true;
  };

  const contentHasValue = /<img\b/i.test(content) || content.replace(/<[^>]*>/g, '').trim() !== '';
  const { onOpenChange, requestClose, dialogProps } = useGuardedClose({
    open,
    onOpenChange: setOpen,
    isDirty: name.trim() !== '' || contentHasValue,
    onSave: name.trim() ? handleAdd : undefined,
    onDiscard: resetDraft,
  });

  const defaultTrigger = (
    <Button type="button" variant="outline" size="sm" className="min-h-[44px]">
      <Plus className="mr-2 h-4 w-4" />
      Add Custom Template
    </Button>
  );

  const triggerNode = trigger ?? defaultTrigger;

  return (
    <>
      <TierBadgeAnchor feature="customTemplates">
        {React.isValidElement(triggerNode) ? (
          React.cloneElement(
            triggerNode as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>,
            {
              onClick: (e: React.MouseEvent) => {
                (
                  triggerNode as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
                ).props.onClick?.(e);
                if (e.defaultPrevented) return;
                openCreateOrUpgrade();
              },
            }
          )
        ) : (
          <button type="button" onClick={openCreateOrUpgrade}>
            {triggerNode}
          </button>
        )}
      </TierBadgeAnchor>

      <ResponsiveModal open={open} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,720px)] max-w-[min(calc(100vw-1.5rem),42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(95vw,42rem)] sm:p-0"
        >
          <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5 sm:py-4">
            <ResponsiveModalTitle className="pr-8 text-base sm:text-lg">
              Create custom template
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
            <div className="space-y-2">
              <Label htmlFor="custom-template-name">Name</Label>
              <Input
                id="custom-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
              />
            </div>
            <RichTextEditor content={content} onChange={setContent} minHeight="240px" />
          </div>
          <ResponsiveModalFooter className="border-border/60 shrink-0 gap-2 border-t px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !name.trim()} onClick={() => void handleAdd()}>
              Create
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
