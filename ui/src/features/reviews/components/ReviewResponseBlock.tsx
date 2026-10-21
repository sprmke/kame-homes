type Props = {
  responseText: string | null;
  label?: string;
};

export function ReviewResponseBlock({ responseText, label = 'Your response' }: Props) {
  if (!responseText) return null;
  return (
    <div className="border-border bg-muted/40 rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 text-sm">{responseText}</p>
    </div>
  );
}
