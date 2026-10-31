import { useEffect, useState } from 'react';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
};

export function MarketingNameDialog({
  open,
  onOpenChange,
  title,
  label = 'Name',
  defaultValue = '',
  confirmLabel = 'Save',
  onConfirm,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  const handleConfirm = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } catch {
      // Parent surfaces errors; keep dialog open for retry.
    }
  };

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      sizeClassName="max-w-[min(calc(100vw-1.5rem),24rem)] sm:max-w-[24rem]"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="marketing-name-input">{label}</Label>
        <Input
          id="marketing-name-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleConfirm();
          }}
        />
      </div>
    </AdminDialogShell>
  );
}
