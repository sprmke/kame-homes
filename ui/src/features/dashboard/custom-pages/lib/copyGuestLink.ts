import { toast } from 'sonner';

/** Copy a guest link and confirm which page was copied. */
export async function copyGuestLink(href: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(href);
    toast.success(`${label} link copied`);
  } catch {
    toast.error('Could not copy link');
  }
}
