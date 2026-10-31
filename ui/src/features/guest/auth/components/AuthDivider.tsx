import { Separator } from '@/components/ui/separator';

interface AuthDividerProps {
  text?: string;
}

export function AuthDivider({ text = 'or continue with' }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background text-muted-foreground px-2">{text}</span>
      </div>
    </div>
  );
}
