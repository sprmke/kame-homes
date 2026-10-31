import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

export function SectionVisibilityToggle({ id, label, checked, onCheckedChange, className }: Props) {
  return (
    <div className={cn('flex min-h-[44px] items-center justify-between gap-3 px-4', className)}>
      <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
