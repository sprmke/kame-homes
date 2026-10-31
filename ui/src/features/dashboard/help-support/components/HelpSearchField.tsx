import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
};

export function HelpSearchField({ value, onChange, placeholder, label }: Props) {
  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 pl-9"
      />
    </div>
  );
}
