import { useState } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useCreateDevelopment } from '@/features/dashboard/super-admin/hooks/useDevelopments';
import { DEVELOPMENT_TYPES } from '@/features/dashboard/super-admin/lib/developmentSettingsConstants';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { useRunUnguarded } from '@/hooks/useUnsavedChangesGuard';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (slug: string) => void;
};

export function AddDevelopmentDialog({ open, onOpenChange, onCreated }: Props) {
  const createDevelopment = useCreateDevelopment();
  const runUnguarded = useRunUnguarded();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(DEVELOPMENT_TYPES[0]!.value);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName('');
      setType(DEVELOPMENT_TYPES[0]!.value);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (): Promise<boolean> => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters');
      return false;
    }
    try {
      const development = await createDevelopment.mutateAsync({ name: trimmed, type });
      toast.success('Development created');
      handleOpenChange(false);
      runUnguarded(() => onCreated(development.slug));
      return true;
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not create development'));
      return false;
    }
  };

  const isDirty = name.trim() !== '' || type !== DEVELOPMENT_TYPES[0]!.value;
  const {
    onOpenChange: guardedOpenChange,
    requestClose,
    dialogProps,
  } = useGuardedClose({ open, onOpenChange: handleOpenChange, isDirty, onSave: handleSubmit });

  return (
    <>
      <AdminDialogShell
        open={open}
        onOpenChange={guardedOpenChange}
        title="Add development"
        footer={
          <>
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={createDevelopment.isPending}
              onClick={() => void handleSubmit()}
              className="min-h-[44px]"
            >
              {createDevelopment.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                'Create'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="development-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="development-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="development-type" className="text-sm font-medium">
              Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="development-type" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_TYPES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AdminDialogShell>
      <UnsavedChangesDialog {...dialogProps} />
    </>
  );
}
