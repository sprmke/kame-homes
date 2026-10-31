export function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? '').trim();
}
