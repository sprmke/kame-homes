/** Quiet empty marker for a filter facet with no options. */
export function FilterEmptyLabel({ label = 'None' }: { label?: string }) {
  return (
    <p className="text-muted-foreground py-1 text-sm" role="status">
      {label}
    </p>
  );
}
